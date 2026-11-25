using System.Text;
using System.Text.RegularExpressions;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.FileProviders;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using CraftyCorner.Api.Controllers;
using CraftyCorner.Api.Data;
using CraftyCorner.Api.Infrastructure;
using CraftyCorner.Api.Models;
using CraftyCorner.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// منصات الاستضافة (Railway, Render...) بتقول لنا على أنهي port نسمع بمتغيّر PORT
if (Environment.GetEnvironmentVariable("PORT") is { Length: > 0 } port)
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

builder.Services.AddControllers();

// ضغط (Brotli/Gzip) للـ JS والـ CSS والـ JSON: فرق كبير في السرعة على استضافة من غير CDN
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat([
        "image/svg+xml",
        "application/manifest+json",
    ]);
});

// خلف reverse proxy (كل منصات الاستضافة): نثق في X-Forwarded-For/Proto عشان الـ HTTPS والـ IP الحقيقي
// (rate limiting بيعتمد عليه) يبقوا صح. مقفول افتراضياً، وبيتفتح بـ Proxy__TrustForwardedHeaders=true.
if (builder.Configuration.GetValue<bool>("Proxy:TrustForwardedHeaders"))
{
    builder.Services.Configure<ForwardedHeadersOptions>(options =>
    {
        options.ForwardedHeaders =
            ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        options.KnownIPNetworks.Clear();
        options.KnownProxies.Clear();
    });
}

// أي خطأ غير متوقع يرجع بنفس الشكل (ProblemDetails) بدل stack trace
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
var connectionString = builder.Configuration.GetConnectionString("Default");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 0)))
);

builder.Services.AddOpenApi();
builder.Services.AddMemoryCache();
builder.Services.AddHttpClient(GeocodeController.ClientName, client =>
{
    client.BaseAddress = new Uri("https://nominatim.openstreetmap.org/");
    client.Timeout = TimeSpan.FromSeconds(5);
    // Nominatim بيطلب User-Agent يعرّف التطبيق
    client.DefaultRequestHeaders.UserAgent.ParseAdd("CraftyCorner/1.0");
});

// CORS: المتصفح بيمنع الـ Angular (localhost:4200) يكلّم الـ API (localhost:5034)
// لأن الـ origin مختلف. هنا بنسمح بالـ origins اللي في appsettings بس.
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];

builder.Services.AddCors(options => options.AddPolicy("Frontend", policy => policy
            .WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            // الـ refresh token في cookie، والمتصفح مش هيبعتها لموقع تاني إلا لو الـ API سمح.
            // AllowCredentials لازم يتعامل مع origins محددة (مش *)، وده اللي عندنا.
            .AllowCredentials()
            .WithExposedHeaders("Location")));

// ---------- Rate limiting ----------
// بنحدّ محاولات تسجيل الدخول والتسجيل لكل IP، عشان ما حدّش يخمّن الباسوردات.
// ملحوظة: خلف reverse proxy لازم نضبط ForwardedHeaders عشان الـ IP يبقى الحقيقي.
var authPermitLimit = builder.Configuration.GetValue("RateLimit:AuthPermitLimit", 10);
var authWindowSeconds = builder.Configuration.GetValue("RateLimit:AuthWindowSeconds", 60);

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = (context, _) =>
    {
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
            context.HttpContext.Response.Headers.RetryAfter = (
                (int)retryAfter.TotalSeconds
            ).ToString();

        return ValueTask.CompletedTask;
    };
    // اقتراح العنوان من الدبوس: بيكلّم خدمة برّة، فبنحدّه لكل مستخدم
    options.AddPolicy("geocode", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.User.FindFirst("sub")?.Value
                ?? httpContext.Connection.RemoteIpAddress?.ToString()
                ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }
        )
    );
    // رسايل "اتصل بنا": محدودة لكل IP عشان ما تتحولش لسبام
    options.AddPolicy("contact", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(10),
                QueueLimit = 0,
            }
        )
    );
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ =>
            {
                // read from the final configuration when the first request arrives (so tests and hosts can override it)
                var configuration = httpContext.RequestServices.GetRequiredService<IConfiguration>();
                return new FixedWindowRateLimiterOptions
                {
                    PermitLimit = configuration.GetValue("RateLimit:AuthPermitLimit", authPermitLimit),
                    Window = TimeSpan.FromSeconds(
                        configuration.GetValue("RateLimit:AuthWindowSeconds", authWindowSeconds)
                    ),
                    QueueLimit = 0,
                };
            }
        )
    );
});

// ---------- Auth (JWT) ----------
// الإعدادات بتتقري وتتفحص عند التشغيل: لو Jwt:Key ناقص أو قصير، التطبيق مش بيشتغل
// ويقولك السبب (أحسن من إنه يشتغل بمفتاح ضعيف).
builder
    .Services.AddOptions<JwtOptions>()
    .BindConfiguration(JwtOptions.SectionName)
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddSingleton(TimeProvider.System);

// الإيميل: طابور + خدمة خلفية بتبعت بـ SMTP. من غير إعدادات (Email:Host) بيفضل مقفول.
builder.Services.Configure<EmailOptions>(
    builder.Configuration.GetSection(EmailOptions.SectionName)
);
// تنبيه على التليفون (Telegram) لما يجي طلب جديد. من غير Notifications:Telegram:BotToken بيفضل مقفول.
builder.Services.Configure<NotificationOptions>(
    builder.Configuration.GetSection(NotificationOptions.SectionName)
);
builder.Services.AddHttpClient<IOrderAlerts, TelegramOrderAlerts>(client =>
    client.Timeout = TimeSpan.FromSeconds(8)
);
builder.Services.AddSingleton<EmailQueue>();
builder.Services.AddSingleton<IEmailQueue>(sp => sp.GetRequiredService<EmailQueue>());
builder.Services.AddHostedService<EmailSenderService>();
builder.Services.AddSingleton<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddSingleton<TokenService>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
builder
    .Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtOptions>>(
        (options, jwtOptions) =>
        {
            var jwt = jwtOptions.Value;

            // بنقرا أسماء الـ claims زي ما هي في التوكن (sub, role, name) من غير تحويل
            options.MapInboundClaims = false;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = jwt.Issuer,
                ValidateAudience = true,
                ValidAudience = jwt.Audience,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromSeconds(30),
                NameClaimType = "name",
                RoleClaimType = "role",
            };

            // الأدمن/العميل الموقوف يتقفل فوراً، مش بعد ما التوكن (15 دقيقة) ينتهي
            options.Events = new JwtBearerEvents
            {
                OnTokenValidated = async context =>
                {
                    if (!int.TryParse(context.Principal?.FindFirst("sub")?.Value, out var userId))
                    {
                        context.Fail("Invalid subject.");
                        return;
                    }

                    var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                    if (!await db.Users.AnyAsync(u => u.Id == userId && u.IsActive))
                        context.Fail("The account is not active.");
                },
            };
        }
    );
builder.Services.AddAuthorization();

var app = builder.Build();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

// الاستضافة: Database__MigrateOnStartup=true بيطبّق الـ migrations لوحده (مفيش وصول للـ database من جهازك)،
// و Seed__DemoData=true بيملا الكتالوج التجريبي (في Development بيتملا دايماً).
var migrateOnStartup = app.Configuration.GetValue<bool>("Database:MigrateOnStartup");
var seedDemoData =
    app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("Seed:DemoData");
if (migrateOnStartup || seedDemoData)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    if (migrateOnStartup)
        await MigrateWithRetryAsync(db, app.Logger);

    if (seedDemoData)
    {
        var seeded = await DbSeeder.SeedAsync(db);
        if (seeded > 0)
            app.Logger.LogInformation("Seeded {Count} demo products", seeded);
    }
}

// أول Admin بيتعمل من الإعدادات (Seed:AdminEmail / Seed:AdminPassword) لو موجودة بس
using (var scope = app.Services.CreateScope())
{
    await AdminSeeder.SeedAsync(
        scope.ServiceProvider.GetRequiredService<AppDbContext>(),
        scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>(),
        app.Configuration,
        app.Logger
    );
}

// لازم يبقى قبل أي حاجة بتقرا الـ scheme أو الـ IP
if (app.Configuration.GetValue<bool>("Proxy:TrustForwardedHeaders"))
    app.UseForwardedHeaders();

// لازم أول حاجة في الـ pipeline عشان يمسك أي exception بعده
app.UseExceptionHandler();

// هيدرز الأمان: بتتحط على كل response (الـ API والموقع)
app.Use(
    async (context, next) =>
    {
        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        headers["Permissions-Policy"] = "camera=(), microphone=(), payment=(), usb=()";
        // الـ API بيرجّع JSON بس: ممنوع أي محتوى نشط. الموقع: نمنع الـ iframe والـ plugins ونقفل الـ base و الـ forms
        headers["Content-Security-Policy"] = context.Request.Path.StartsWithSegments("/api")
            ? "default-src 'none'; frame-ancestors 'none'"
            : "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";
        await next();
    }
);

// HSTS: المتصفح يفضل يفتح الموقع HTTPS بس (مش في التطوير)
if (!app.Environment.IsDevelopment())
    app.UseHsts();

// بيحوّل الـ 404 و 405 و 415 الفاضية لـ ProblemDetails
app.UseStatusCodePages();

app.UseHttpsRedirection();

// صور المنتجات اللي الأونر بيرفعها من الداشبورد: بتتخزّن في فولدر (Uploads:Path) وبتتخدم من /uploads
var uploadsFolder = UploadsController.UploadsFolder(app.Configuration, app.Environment);
Directory.CreateDirectory(uploadsFolder);
app.UseStaticFiles(
    new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(uploadsFolder),
        RequestPath = UploadsController.RequestPath,
        OnPrepareResponse = context =>
        {
            context.Context.Response.Headers.CacheControl = "public,max-age=604800,immutable";
            context.Context.Response.Headers["X-Content-Type-Options"] = "nosniff";
        },
    }
);

// الموقع (Angular) بيتخدم من نفس الـ API لو الملفات موجودة في wwwroot (جوه الـ Docker image):
// رابط واحد، ومفيش CORS، والـ cookie بتاع الـ refresh token first-party.
var webRoot = app.Environment.WebRootPath;
var serveWebsite = webRoot is not null && File.Exists(Path.Combine(webRoot, "index.html"));
var staticFiles = new StaticFileOptions
{
    OnPrepareResponse = context =>
    {
        var name = context.File.Name;
        context.Context.Response.Headers.CacheControl = name switch
        {
            // الصفحة الرئيسية دايماً تتجدد، عشان تشاور على آخر ملفات
            "index.html" => "no-cache",
            // main-AB12CD34.js : الاسم فيه hash، يتخزّن سنة
            _ when HashedAsset().IsMatch(name) => "public,max-age=31536000,immutable",
            _ => "public,max-age=86400",
        };
    },
};
if (serveWebsite)
{
    app.UseResponseCompression();
    app.UseDefaultFiles();
    app.UseStaticFiles(staticFiles);
}

// الترتيب مهم: CORS ثم Authentication (مين انت؟) ثم Authorization (مسموح لك؟)
app.UseCors("Frontend");

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// فحص صحة بسيط (للمنصة وللـ uptime monitors): بيتأكد إن الـ database شغّالة
app.MapGet("/api/health", async (AppDbContext db) =>
    await db.Database.CanConnectAsync()
        ? Results.Ok(new { status = "ok" })
        : Results.Problem("The database is not reachable.", statusCode: 503)
);

if (serveWebsite)
{
    // أي /api/... مش موجود يرجّع 404 مش صفحة الموقع
    app.MapFallback("/api/{**rest}", () => Results.NotFound());
    app.MapFallback("/uploads/{**rest}", () => Results.NotFound());
    // باقي الروابط (/products/5, /cart...) هي routes الـ Angular: نرجّع index.html
    app.MapFallbackToFile("index.html", staticFiles);
}

app.Run();

static async Task MigrateWithRetryAsync(AppDbContext db, ILogger logger)
{
    // الـ database ممكن تكون لسه بتقوم لما التطبيق يشتغل (docker compose / Railway)، فبنحاول كذا مرة
    const int attempts = 10;
    for (var attempt = 1; ; attempt++)
    {
        try
        {
            await db.Database.MigrateAsync();
            return;
        }
        catch (Exception ex) when (attempt < attempts)
        {
            logger.LogWarning(
                ex,
                "Database not ready (attempt {Attempt} of {Max}), retrying in 3 seconds",
                attempt,
                attempts
            );
            await Task.Delay(TimeSpan.FromSeconds(3));
        }
    }
}

// الملفات اللي اسمها فيه hash من الـ Angular build: main-ABC123XY.js و chunk-... و styles-...
public partial class Program
{
    [GeneratedRegex(@"-[A-Z0-9]{8}\.(js|css)$")]
    internal static partial Regex HashedAsset();
}
