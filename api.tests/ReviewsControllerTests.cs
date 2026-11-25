using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CraftyCorner.Api.Controllers;
using CraftyCorner.Api.Dtos;
using CraftyCorner.Api.Models;

namespace CraftyCorner.Api.Tests;

public class ReviewsControllerTests : IDisposable
{
    private readonly TestDb t = new();

    public void Dispose() => t.Dispose();

    private ReviewsController As(int? userId) =>
        TestDb.SignedInAs(new ReviewsController(t.Db, TimeProvider.System), userId);

    private static int StatusOf(IActionResult result) =>
        result switch
        {
            ObjectResult o => o.StatusCode ?? 200,
            StatusCodeResult s => s.StatusCode,
            _ => 200,
        };

    [Theory]
    [InlineData("Ahmed Elsaid", "Ahmed E.")]
    [InlineData("Ahmed Mohamed Elsaid", "Ahmed E.")]
    [InlineData("Sara", "Sara")]
    [InlineData("  ", "-")]
    public void PublicName_shows_a_first_name_and_one_initial(string full, string expected) =>
        Assert.Equal(expected, ReviewsController.PublicName(full));

    [Fact]
    public async Task Get_returns_404_for_a_hidden_product()
    {
        var hidden = t.AddProduct(active: false);

        var result = await As(null).Get(hidden.Id);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task Save_is_refused_when_the_customer_has_not_received_the_product()
    {
        var user = t.AddUser();
        var product = t.AddProduct();
        t.AddOrder(user, product, OrderStatus.Placed);
        t.AddOrder(user, product, OrderStatus.Shipped);

        var result = await As(user.Id).Save(product.Id, new SaveReviewDto(5, "Lovely"));

        Assert.Equal(403, StatusOf(result));
        Assert.Empty(t.Db.Reviews);
    }

    [Fact]
    public async Task Save_is_refused_for_a_product_the_customer_never_ordered()
    {
        var user = t.AddUser();
        var other = t.AddUser("Omar K", "omar@example.com");
        var product = t.AddProduct();
        t.AddOrder(other, product, OrderStatus.Delivered); // somebody else received it

        var result = await As(user.Id).Save(product.Id, new SaveReviewDto(5, null));

        Assert.Equal(403, StatusOf(result));
    }

    [Fact]
    public async Task Save_requires_a_signed_in_user()
    {
        var product = t.AddProduct();

        var result = await As(null).Save(product.Id, new SaveReviewDto(5, null));

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task Save_creates_a_review_after_delivery_and_trims_the_comment()
    {
        var user = t.AddUser();
        var product = t.AddProduct();
        t.AddOrder(user, product, OrderStatus.Delivered);

        var result = await As(user.Id).Save(product.Id, new SaveReviewDto(4, "  Nice  "));

        Assert.IsType<NoContentResult>(result);
        var review = Assert.Single(t.Db.Reviews);
        Assert.Equal(4, review.Rating);
        Assert.Equal("Nice", review.Comment);
    }

    [Fact]
    public async Task Saving_again_edits_the_same_review()
    {
        var user = t.AddUser();
        var product = t.AddProduct();
        t.AddOrder(user, product, OrderStatus.Delivered);

        await As(user.Id).Save(product.Id, new SaveReviewDto(2, "Meh"));
        await As(user.Id).Save(product.Id, new SaveReviewDto(5, "   "));

        var review = Assert.Single(t.Db.Reviews);
        Assert.Equal(5, review.Rating);
        Assert.Null(review.Comment); // blank comment is stored as nothing
    }

    [Fact]
    public async Task Get_summarises_ratings_and_marks_my_review_and_whether_I_can_review()
    {
        var ana = t.AddUser("Ana Test", "ana@example.com");
        var omar = t.AddUser("Omar Khaled", "omar@example.com");
        var product = t.AddProduct();
        t.AddOrder(ana, product, OrderStatus.Delivered);
        t.AddOrder(omar, product, OrderStatus.Delivered);
        await As(ana.Id).Save(product.Id, new SaveReviewDto(5, "Great"));
        await As(omar.Id).Save(product.Id, new SaveReviewDto(4, null));

        var summary = (await As(ana.Id).Get(product.Id)).Value!;

        Assert.Equal(2, summary.Count);
        Assert.Equal(4.5, summary.Average);
        Assert.Equal([0, 0, 0, 1, 1], summary.Distribution);
        Assert.Equal(2, summary.Items.Count);
        Assert.Single(summary.Items, r => r.IsMine);
        Assert.Contains(summary.Items, r => r.AuthorName == "Omar K.");
        Assert.True(summary.CanReview);

        var anonymous = (await As(null).Get(product.Id)).Value!;
        Assert.False(anonymous.CanReview);
        Assert.DoesNotContain(anonymous.Items, r => r.IsMine);
    }

    [Fact]
    public async Task Get_for_a_product_without_reviews_is_empty_not_an_error()
    {
        var product = t.AddProduct();

        var summary = (await As(null).Get(product.Id)).Value!;

        Assert.Equal(0, summary.Count);
        Assert.Equal(0, summary.Average);
        Assert.Equal([0, 0, 0, 0, 0], summary.Distribution);
    }

    [Fact]
    public async Task Delete_removes_only_my_own_review()
    {
        var ana = t.AddUser("Ana Test", "ana@example.com");
        var omar = t.AddUser("Omar Khaled", "omar@example.com");
        var product = t.AddProduct();
        t.AddOrder(ana, product, OrderStatus.Delivered);
        t.AddOrder(omar, product, OrderStatus.Delivered);
        await As(ana.Id).Save(product.Id, new SaveReviewDto(5, null));
        await As(omar.Id).Save(product.Id, new SaveReviewDto(3, null));

        await As(ana.Id).Delete(product.Id);

        var left = await t.New().Reviews.ToListAsync();
        Assert.Equal(omar.Id, Assert.Single(left).UserId);
    }

    [Fact]
    public async Task The_database_allows_one_review_per_customer_per_product()
    {
        var user = t.AddUser();
        var product = t.AddProduct();
        t.Db.Reviews.Add(new Review { ProductId = product.Id, UserId = user.Id, Rating = 5 });
        t.Db.SaveChanges();

        t.Db.Reviews.Add(new Review { ProductId = product.Id, UserId = user.Id, Rating = 1 });

        await Assert.ThrowsAsync<DbUpdateException>(() => t.Db.SaveChangesAsync());
    }
}
