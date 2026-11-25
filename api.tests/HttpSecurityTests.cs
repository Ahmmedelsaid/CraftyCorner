using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using CraftyCorner.Api.Dtos;
using CraftyCorner.Api.Models;

namespace CraftyCorner.Api.Tests;

/// <summary>Security behaviour checked through the real HTTP pipeline.</summary>
public class HttpSecurityTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    // ---------- headers

    [Fact]
    public async Task Every_response_carries_the_security_headers()
    {
        var response = await factory.CreateClient().GetAsync("/api/products");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").Single());
        Assert.Equal("strict-origin-when-cross-origin", response.Headers.GetValues("Referrer-Policy").Single());
        Assert.Contains("camera=()", response.Headers.GetValues("Permissions-Policy").Single());
    }

    [Fact]
    public async Task The_API_forbids_any_active_content_and_framing()
    {
        var response = await factory.CreateClient().GetAsync("/api/products");

        var csp = response.Headers.GetValues("Content-Security-Policy").Single();
        Assert.Contains("default-src 'none'", csp);
        Assert.Contains("frame-ancestors 'none'", csp);
    }

    [Fact]
    public async Task Pages_outside_the_API_cannot_be_framed_either()
    {
        var response = await factory.CreateClient().GetAsync("/does-not-exist");

        var csp = response.Headers.GetValues("Content-Security-Policy").Single();
        Assert.Contains("frame-ancestors 'none'", csp);
        Assert.Contains("object-src 'none'", csp);
    }

    // ---------- who may call what

    [Theory]
    [InlineData("GET", "/api/admin/orders")]
    [InlineData("GET", "/api/admin/products")]
    [InlineData("GET", "/api/admin/users")]
    [InlineData("GET", "/api/admin/reviews")]
    [InlineData("GET", "/api/admin/categories")]
    [InlineData("GET", "/api/admin/stats")]
    [InlineData("GET", "/api/admin/messages")]
    [InlineData("POST", "/api/admin/uploads")]
    public async Task Admin_endpoints_reject_anonymous_visitors_with_401(string method, string url)
    {
        var response = await factory.CreateClient().SendAsync(new HttpRequestMessage(new HttpMethod(method), url));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("GET", "/api/admin/orders")]
    [InlineData("GET", "/api/admin/products")]
    [InlineData("GET", "/api/admin/users")]
    [InlineData("GET", "/api/admin/reviews")]
    [InlineData("GET", "/api/admin/categories")]
    [InlineData("GET", "/api/admin/stats")]
    [InlineData("GET", "/api/admin/messages")]
    public async Task Admin_endpoints_reject_a_customer_with_403(string method, string url)
    {
        var customer = await factory.ClientFor(factory.AddUser());

        var response = await customer.SendAsync(new HttpRequestMessage(new HttpMethod(method), url));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task A_customer_cannot_create_an_admin_or_change_a_product()
    {
        var customer = await factory.ClientFor(factory.AddUser());
        var productId = factory.AddProduct();

        var createAdmin = await customer.PostAsJsonAsync(
            "/api/admin/users",
            new { email = "evil@example.com", fullName = "Evil", password = ApiFactory.Password }
        );
        var deleteProduct = await customer.DeleteAsync($"/api/products/{productId}");

        Assert.Equal(HttpStatusCode.Forbidden, createAdmin.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, deleteProduct.StatusCode);
        Assert.True(factory.WithDb(db => db.Products.Single(p => p.Id == productId).IsActive));
    }

    [Theory]
    [InlineData("/api/orders")]
    [InlineData("/api/cart")]
    [InlineData("/api/wishlist")]
    public async Task Customer_areas_reject_anonymous_visitors(string url)
    {
        var response = await factory.CreateClient().GetAsync(url);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task The_public_catalogue_and_reviews_need_no_login()
    {
        var productId = factory.AddProduct();
        var client = factory.CreateClient();

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/products")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/categories")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/products/{productId}/reviews")).StatusCode);
    }

    [Fact]
    public async Task A_garbage_or_forged_token_is_rejected()
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "not.a.token");

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/orders")).StatusCode);
    }

    // ---------- accounts

    [Fact]
    public async Task A_deactivated_account_is_locked_out_at_once_not_when_its_token_expires()
    {
        var userId = factory.AddUser();
        var client = await factory.ClientFor(userId);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/orders")).StatusCode);

        factory.WithDb(db =>
        {
            db.Users.Single(u => u.Id == userId).IsActive = false;
            return db.SaveChanges();
        });

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/orders")).StatusCode);
    }

    [Fact]
    public async Task Registering_never_lets_the_caller_choose_the_role()
    {
        var email = $"{Guid.NewGuid():N}@example.com";

        var response = await factory.CreateClient().PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                email,
                password = ApiFactory.Password,
                fullName = "Sneaky",
                phone = "01012345678",
                role = "Admin",
                isActive = true,
            }
        );

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(UserRole.Customer, factory.WithDb(db => db.Users.Single(u => u.Email == email).Role));
    }

    [Fact]
    public async Task Registering_rejects_a_bad_phone_and_a_weak_password()
    {
        var client = factory.CreateClient();

        var badPhone = await client.PostAsJsonAsync(
            "/api/auth/register",
            new RegisterDto($"{Guid.NewGuid():N}@example.com", ApiFactory.Password, "Ana Test", "12345")
        );
        var weak = await client.PostAsJsonAsync(
            "/api/auth/register",
            new RegisterDto($"{Guid.NewGuid():N}@example.com", "password", "Ana Test", "01012345678")
        );

        Assert.Equal(HttpStatusCode.BadRequest, badPhone.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, weak.StatusCode);
    }

    [Fact]
    public async Task The_login_endpoint_is_rate_limited_per_client()
    {
        using var limited = factory.WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration(
                (_, config) =>
                    config.AddInMemoryCollection(
                        new Dictionary<string, string?> { ["RateLimit:AuthPermitLimit"] = "3" }
                    )
            )
        );
        var client = limited.CreateClient();
        var body = new LoginDto("nobody@example.com", "wrong-password");

        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 5; i++)
            statuses.Add((await client.PostAsJsonAsync("/api/auth/login", body)).StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, statuses[0]);
        Assert.Contains(HttpStatusCode.TooManyRequests, statuses);
    }

    [Fact]
    public async Task Errors_are_a_plain_problem_without_internal_details()
    {
        var response = await factory.CreateClient().GetAsync("/api/products/not-a-number");

        Assert.True((int)response.StatusCode >= 400);
        var text = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("StackTrace", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(" at CraftyCorner", text);
    }
}
