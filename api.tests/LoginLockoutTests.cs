using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using CraftyCorner.Api.Controllers;
using CraftyCorner.Api.Dtos;
using CraftyCorner.Api.Infrastructure;
using CraftyCorner.Api.Models;
using CraftyCorner.Api.Services;

namespace CraftyCorner.Api.Tests;

public class LoginLockoutTests : IDisposable
{
    private const string Password = "Passw0rd!1";

    private readonly TestDb t = new();
    private readonly ManualClock clock = new();
    private readonly PasswordHasher<User> hasher = new();

    public void Dispose() => t.Dispose();

    private sealed class ManualClock : TimeProvider
    {
        private DateTimeOffset now = new(2026, 11, 25, 12, 0, 0, TimeSpan.Zero);

        public override DateTimeOffset GetUtcNow() => now;

        public void Advance(TimeSpan by) => now += by;
    }

    private sealed class FakeEnvironment : Microsoft.AspNetCore.Hosting.IWebHostEnvironment
    {
        public string ApplicationName { get; set; } = "tests";
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
        public string WebRootPath { get; set; } = "";
        public string EnvironmentName { get; set; } = "Development";
        public string ContentRootPath { get; set; } = "";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    private AuthController Controller()
    {
        var jwt = Options.Create(
            new JwtOptions
            {
                Issuer = "tests",
                Audience = "tests",
                Key = new string('k', 48),
            }
        );
        var controller = new AuthController(
            t.New(),
            hasher,
            new TokenService(jwt, clock),
            jwt,
            clock,
            new FakeEnvironment(),
            NullLogger<AuthController>.Instance
        );
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        return controller;
    }

    private User AddCustomer(bool active = true)
    {
        var user = new User
        {
            Email = "ana@example.com",
            FullName = "Ana Test",
            PasswordHash = "",
            IsActive = active,
        };
        user.PasswordHash = hasher.HashPassword(user, Password);
        t.Db.Users.Add(user);
        t.Db.SaveChanges();
        return user;
    }

    private static int? StatusOf(ActionResult<AuthResponse> result) =>
        (result.Result as ObjectResult)?.StatusCode;

    private Task<ActionResult<AuthResponse>> TryLogin(string password, string email = "ana@example.com") =>
        Controller().Login(new LoginDto(email, password));

    [Fact]
    public async Task A_wrong_password_is_401_and_a_correct_one_signs_in()
    {
        AddCustomer();

        Assert.Equal(401, StatusOf(await TryLogin("wrong")));
        Assert.NotNull((await TryLogin(Password)).Value);
    }

    [Fact]
    public async Task An_unknown_email_gets_the_same_401_as_a_wrong_password()
    {
        AddCustomer();

        var wrong = Assert.IsType<ObjectResult>((await TryLogin("wrong")).Result);
        var unknown = Assert.IsType<ObjectResult>((await TryLogin("wrong", "nobody@example.com")).Result);

        Assert.Equal(wrong.StatusCode, unknown.StatusCode);
        Assert.Equal(
            ((ProblemDetails)wrong.Value!).Detail,
            ((ProblemDetails)unknown.Value!).Detail
        );
    }

    [Fact]
    public async Task Five_wrong_passwords_lock_the_account_even_for_the_right_password()
    {
        AddCustomer();

        for (var i = 0; i < 5; i++)
            Assert.Equal(401, StatusOf(await TryLogin("wrong")));

        var controller = Controller();
        var locked = await controller.Login(new LoginDto("ana@example.com", Password));

        Assert.Equal(429, StatusOf(locked));
        Assert.True(int.Parse(controller.Response.Headers.RetryAfter.ToString()) > 0);
        Assert.NotNull(t.New().Users.Single().LockedUntil);
    }

    [Fact]
    public async Task Four_wrong_passwords_do_not_lock_and_a_good_login_resets_the_count()
    {
        AddCustomer();

        for (var i = 0; i < 4; i++)
            await TryLogin("wrong");
        Assert.NotNull((await TryLogin(Password)).Value);
        Assert.Equal(0, t.New().Users.Single().FailedLoginCount);

        // the count started over, so four more failures still do not lock it
        for (var i = 0; i < 4; i++)
            await TryLogin("wrong");
        Assert.NotNull((await TryLogin(Password)).Value);
    }

    [Fact]
    public async Task The_lock_ends_after_fifteen_minutes()
    {
        AddCustomer();
        for (var i = 0; i < 5; i++)
            await TryLogin("wrong");
        Assert.Equal(429, StatusOf(await TryLogin(Password)));

        clock.Advance(TimeSpan.FromMinutes(14));
        Assert.Equal(429, StatusOf(await TryLogin(Password)));

        clock.Advance(TimeSpan.FromMinutes(2));
        Assert.NotNull((await TryLogin(Password)).Value);
        Assert.Null(t.New().Users.Single().LockedUntil);
    }

    [Fact]
    public async Task A_deactivated_account_cannot_sign_in_even_with_the_right_password()
    {
        AddCustomer(active: false);

        Assert.Equal(401, StatusOf(await TryLogin(Password)));
    }
}
