using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using CraftyCorner.Api.Data;
using CraftyCorner.Api.Dtos;
using CraftyCorner.Api.Models;

namespace CraftyCorner.Api.Tests;

/// <summary>
/// Starts the real application (all middleware, auth, rate limiting, controllers) in memory, with the
/// MySQL database swapped for SQLite. Requests go through the whole HTTP pipeline.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    private readonly string? databaseFile;
    private readonly Action<IServiceCollection>? extraServices;

    /// <summary>Tests: one shared in-memory database.</summary>
    public ApiFactory() { }

    /// <summary>Browser host: a database file, one connection per request.</summary>
    internal ApiFactory(string databaseFile) => this.databaseFile = databaseFile;

    /// <summary>Tests that replace a service (for example a fake alert sender).</summary>
    internal ApiFactory(Action<IServiceCollection> services) => extraServices = services;

    public const string Password = "Passw0rd!1";

    private readonly SqliteConnection connection = new("DataSource=:memory:");
    private readonly string uploads = Path.Combine(Path.GetTempPath(), "cc-tests-" + Guid.NewGuid().ToString("N"));
    private readonly string receipts = Path.Combine(Path.GetTempPath(), "cc-receipts-" + Guid.NewGuid().ToString("N"));

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration(
            (_, config) =>
                config.AddInMemoryCollection(
                    new Dictionary<string, string?>
                    {
                        ["ConnectionStrings:Default"] = "Server=unused",
                        ["Jwt:Key"] = new string('k', 48),
                        ["Jwt:Issuer"] = "CraftyCorner",
                        ["Jwt:Audience"] = "CraftyCorner.Web",
                        ["Uploads:Path"] = uploads,
                        ["Receipts:Path"] = receipts,
                        // plenty of logins per minute: the rate limit has its own test
                        ["RateLimit:AuthPermitLimit"] = "1000",
                    }
                )
        );

        builder.ConfigureServices(services =>
        {
            foreach (
                var descriptor in services
                    .Where(d =>
                        d.ServiceType == typeof(DbContextOptions<AppDbContext>)
                        || (
                            d.ServiceType.IsGenericType
                            && d.ServiceType.GetGenericArguments().Contains(typeof(AppDbContext))
                        )
                    )
                    .ToList()
            )
                services.Remove(descriptor);

            extraServices?.Invoke(services);

            // Tests share one open in-memory connection. A browser run (a file) needs one connection per
            // request, because the page fires several requests at once.
            if (databaseFile is null)
            {
                if (connection.State != System.Data.ConnectionState.Open)
                    connection.Open();
                services.AddDbContext<AppDbContext>(options => options.UseSqlite(connection));
            }
            else
            {
                services.AddDbContext<AppDbContext>(options =>
                    options.UseSqlite($"Data Source={databaseFile};Default Timeout=30;Pooling=False")
                );
            }
        });
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        var host = base.CreateHost(builder);
        using var scope = host.Services.CreateScope();
        scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.EnsureCreated();
        return host;
    }

    /// <summary>Runs <paramref name="work"/> against the database the application uses.</summary>
    public T WithDb<T>(Func<AppDbContext, T> work)
    {
        using var scope = Services.CreateScope();
        return work(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }

    public int AddUser(UserRole role = UserRole.Customer, bool active = true)
    {
        var email = $"{Guid.NewGuid():N}@example.com";
        return WithDb(db =>
        {
            var user = new User
            {
                Email = email,
                FullName = "Test User",
                PasswordHash = "",
                Role = role,
                IsActive = active,
            };
            user.PasswordHash = new PasswordHasher<User>().HashPassword(user, Password);
            db.Users.Add(user);
            db.SaveChanges();
            return user.Id;
        });
    }

    /// <summary>An admin with a fixed email (for the browser test host).</summary>
    public void AddAdmin(string email) =>
        WithDb(db =>
        {
            var admin = new User { Email = email, FullName = "E2E Admin", PasswordHash = "", Role = UserRole.Admin };
            admin.PasswordHash = new PasswordHasher<User>().HashPassword(admin, Password);
            db.Users.Add(admin);
            return db.SaveChanges();
        });

    public string EmailOf(int userId) => WithDb(db => db.Users.Single(u => u.Id == userId).Email);

    public int AddProduct(int stock = 5, bool active = true)
    {
        return WithDb(db =>
        {
            var category = db.Categories.FirstOrDefault() ?? db.Categories.Add(new Category { Name = "Decor", Slug = "decor", IsActive = true }).Entity;
            var brand = db.Brands.FirstOrDefault() ?? db.Brands.Add(new Brand { Name = "Crafty", Slug = "crafty", IsActive = true }).Entity;
            var product = new Product
            {
                Name = "Vase",
                Slug = "vase-" + Guid.NewGuid().ToString("N")[..8],
                Sku = "SKU-" + Guid.NewGuid().ToString("N")[..8],
                Price = 120,
                StockQuantity = stock,
                IsActive = active,
                Category = category,
                Brand = brand,
            };
            db.Products.Add(product);
            db.SaveChanges();
            return product.Id;
        });
    }

    /// <summary>A client signed in as the user (it carries the access token, like the Angular app).</summary>
    public async Task<HttpClient> ClientFor(int userId)
    {
        var client = CreateClient();
        // the owner signs in through the dashboard (which says so with this header); customers through the store
        var isOwner = WithDb(db => db.Users.Single(u => u.Id == userId).Role == UserRole.Admin);
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = JsonContent.Create(new LoginDto(EmailOf(userId), Password)),
        };
        if (isOwner)
            request.Headers.Add("X-Client-App", "admin");
        var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();
        var session = (await response.Content.ReadFromJsonAsync<AuthResponse>())!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);
        return client;
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        connection.Dispose();
        try
        {
            if (Directory.Exists(uploads))
                Directory.Delete(uploads, recursive: true);
            if (Directory.Exists(receipts))
                Directory.Delete(receipts, recursive: true);
        }
        catch (IOException)
        {
            // a temp folder: not worth failing a test run over
        }
    }
}
