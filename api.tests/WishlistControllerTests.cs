using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CraftyCorner.Api.Controllers;

namespace CraftyCorner.Api.Tests;

public class WishlistControllerTests : IDisposable
{
    private readonly TestDb t = new();

    public void Dispose() => t.Dispose();

    private WishlistController As(int? userId) =>
        TestDb.SignedInAs(new WishlistController(t.Db), userId);

    [Fact]
    public async Task Everything_needs_a_signed_in_user()
    {
        var product = t.AddProduct();

        Assert.IsType<UnauthorizedResult>((await As(null).List()).Result);
        Assert.IsType<UnauthorizedResult>(await As(null).Add(product.Id));
        Assert.IsType<UnauthorizedResult>(await As(null).Remove(product.Id));
    }

    [Fact]
    public async Task Add_saves_the_product_and_list_returns_it_with_its_names_and_rating()
    {
        var user = t.AddUser();
        var product = t.AddProduct("Crescent Set");

        Assert.IsType<NoContentResult>(await As(user.Id).Add(product.Id));

        var list = (await As(user.Id).List()).Value!;
        var item = Assert.Single(list);
        Assert.Equal(product.Id, item.Id);
        Assert.Equal("Crescent Set", item.Name);
        Assert.Equal(0, item.RatingCount);
    }

    [Fact]
    public async Task Adding_twice_keeps_one_row()
    {
        var user = t.AddUser();
        var product = t.AddProduct();

        await As(user.Id).Add(product.Id);
        await As(user.Id).Add(product.Id);

        Assert.Equal(1, await t.New().WishlistItems.CountAsync());
    }

    [Fact]
    public async Task Add_returns_404_for_a_missing_or_hidden_product()
    {
        var user = t.AddUser();
        var hidden = t.AddProduct(active: false);

        Assert.IsType<NotFoundResult>(await As(user.Id).Add(9999));
        Assert.IsType<NotFoundResult>(await As(user.Id).Add(hidden.Id));
    }

    [Fact]
    public async Task Remove_deletes_it_and_is_fine_when_it_was_not_saved()
    {
        var user = t.AddUser();
        var product = t.AddProduct();
        await As(user.Id).Add(product.Id);

        Assert.IsType<NoContentResult>(await As(user.Id).Remove(product.Id));
        Assert.IsType<NoContentResult>(await As(user.Id).Remove(product.Id));

        Assert.Empty((await As(user.Id).List()).Value!);
    }

    [Fact]
    public async Task Customers_only_see_and_change_their_own_list()
    {
        var ana = t.AddUser("Ana Test", "ana@example.com");
        var omar = t.AddUser("Omar Khaled", "omar@example.com");
        var product = t.AddProduct();
        await As(ana.Id).Add(product.Id);

        Assert.Empty((await As(omar.Id).List()).Value!);

        await As(omar.Id).Remove(product.Id); // must not touch Ana's row
        Assert.Single((await As(ana.Id).List()).Value!);
    }

    [Fact]
    public async Task List_hides_products_the_owner_has_hidden_and_shows_newest_first()
    {
        var user = t.AddUser();
        var first = t.AddProduct("First");
        var second = t.AddProduct("Second");
        var third = t.AddProduct("Third");
        await As(user.Id).Add(first.Id);
        await Task.Delay(15);
        await As(user.Id).Add(second.Id);
        await Task.Delay(15);
        await As(user.Id).Add(third.Id);

        third.IsActive = false;
        t.Db.SaveChanges();

        var names = (await As(user.Id).List()).Value!.Select(p => p.Name).ToList();
        Assert.Equal(["Second", "First"], names);
    }
}
