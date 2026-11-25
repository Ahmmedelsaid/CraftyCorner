using Microsoft.Extensions.DependencyInjection;
using CraftyCorner.Api.Data;

namespace CraftyCorner.Api.Tests;

/// <summary>
/// A throwaway copy of the real API for browser (Playwright) runs on a machine with no MySQL:
/// the same application on a real port, backed by in-memory SQLite, with the demo catalogue and an admin.
///
///   $env:E2E_HOST = "1"; dotnet test api.tests --filter E2EHost
///
/// It listens on http://localhost:5034 (what the Angular dev server expects) and runs until the process is
/// stopped. A normal `dotnet test` skips it. Nothing here touches your development database.
/// </summary>
public class E2EHost
{
    public const string AdminEmail = "e2e-admin@example.com";

    [Fact]
    public async Task Run()
    {
        if (Environment.GetEnvironmentVariable("E2E_HOST") != "1")
            return;

        var port = int.Parse(Environment.GetEnvironmentVariable("E2E_PORT") ?? "5034");

        var file = Path.Combine(Path.GetTempPath(), $"cc-e2e-{Guid.NewGuid():N}.db");
        await using var factory = new ApiFactory(file);
        factory.UseKestrel(port);
        factory.StartServer();

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await DbSeeder.SeedAsync(db);
        }
        factory.AddAdmin(AdminEmail);

        Console.WriteLine($"E2E host ready on http://localhost:{port} (admin {AdminEmail} / {ApiFactory.Password})");
        await Task.Delay(Timeout.Infinite);
    }
}
