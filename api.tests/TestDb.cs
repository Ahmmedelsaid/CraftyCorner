using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using CraftyCorner.Api.Data;
using CraftyCorner.Api.Models;

namespace CraftyCorner.Api.Tests;

/// <summary>
/// A real (in-memory SQLite) database per test, so queries, unique indexes and ExecuteDelete behave like
/// the real thing. It is built from the same model as production.
/// </summary>
public sealed class TestDb : IDisposable
{
    private readonly SqliteConnection connection = new("DataSource=:memory:");

    public AppDbContext Db { get; }

    public TestDb()
    {
        connection.Open();
        Db = New();
        Db.Database.EnsureCreated();
    }

    /// <summary>A second context on the same database (what another request would see).</summary>
    public AppDbContext New() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);

    public User AddUser(string name = "Ana Test", string email = "ana@example.com", UserRole role = UserRole.Customer)
    {
        var user = new User
        {
            Email = email,
            FullName = name,
            PasswordHash = "x",
            Role = role,
        };
        Db.Users.Add(user);
        Db.SaveChanges();
        return user;
    }

    public Product AddProduct(string name = "Vase", bool active = true)
    {
        var category = Db.Categories.FirstOrDefault() ?? Db.Categories.Add(new Category { Name = "Decor", Slug = "decor", IsActive = true }).Entity;
        var brand = Db.Brands.FirstOrDefault() ?? Db.Brands.Add(new Brand { Name = "Crafty", Slug = "crafty", IsActive = true }).Entity;
        var product = new Product
        {
            Name = name,
            Slug = name.ToLowerInvariant() + "-" + Guid.NewGuid().ToString("N")[..6],
            Sku = "SKU-" + Guid.NewGuid().ToString("N")[..8],
            Price = 100,
            StockQuantity = 5,
            IsActive = active,
            Category = category,
            Brand = brand,
        };
        Db.Products.Add(product);
        Db.SaveChanges();
        return product;
    }

    public Order AddOrder(User user, Product product, OrderStatus status)
    {
        var order = new Order
        {
            UserId = user.Id,
            Status = status,
            ShippingName = user.FullName,
            Phone = "01012345678",
            Address = "12 Nile St",
            City = "Giza",
            Total = product.Price,
            Items =
            [
                new OrderItem
                {
                    ProductId = product.Id,
                    ProductName = product.Name,
                    UnitPrice = product.Price,
                    Quantity = 1,
                },
            ],
        };
        Db.Orders.Add(order);
        Db.SaveChanges();
        return order;
    }

    /// <summary>Makes the controller think <paramref name="userId"/> is signed in (null = anonymous).</summary>
    public static T SignedInAs<T>(T controller, int? userId, string role = "Customer")
        where T : ControllerBase
    {
        var identity = userId is null
            ? new ClaimsIdentity()
            : new ClaimsIdentity(
                [new Claim("sub", userId.ToString()!), new Claim("role", role)],
                authenticationType: "test",
                nameType: "name",
                roleType: "role"
            );
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) },
        };
        return controller;
    }

    public void Dispose()
    {
        Db.Dispose();
        connection.Dispose();
    }
}
