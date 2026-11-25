using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using CraftyCorner.Api.Dtos;
using CraftyCorner.Api.Models;

namespace CraftyCorner.Api.Tests;

/// <summary>The money path, end to end over HTTP: cart, order, stock, cancel, and who may see what.</summary>
public class CheckoutFlowTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static object Order(string phone = "01012345678", object? extra = null) =>
        extra ?? new
        {
            shippingName = "Ana Test",
            phone,
            address = "12 Nile St, Dokki",
            city = "Giza",
        };

    private static Task<HttpResponseMessage> AddToCart(HttpClient client, int productId, int quantity) =>
        client.PostAsJsonAsync("/api/cart/items", new AddCartItemDto(productId, quantity));

    private int Stock(int productId) =>
        factory.WithDb(db => db.Products.AsNoTracking().Single(p => p.Id == productId).StockQuantity);

    [Fact]
    public async Task A_customer_can_register_fill_a_cart_and_place_an_order()
    {
        var productId = factory.AddProduct(stock: 5);
        var client = factory.CreateClient();
        var register = await client.PostAsJsonAsync(
            "/api/auth/register",
            new RegisterDto($"{Guid.NewGuid():N}@example.com", ApiFactory.Password, "Ana Test", "01012345678")
        );
        var session = (await register.Content.ReadFromJsonAsync<AuthResponse>())!;
        client.DefaultRequestHeaders.Authorization = new("Bearer", session.AccessToken);

        Assert.Equal(HttpStatusCode.OK, (await AddToCart(client, productId, 2)).StatusCode);
        var placed = await client.PostAsJsonAsync("/api/orders", Order("+20 101 234 5678"));

        Assert.Equal(HttpStatusCode.Created, placed.StatusCode);
        var order = (await placed.Content.ReadFromJsonAsync<OrderDto>())!;
        Assert.Equal("Placed", order.Status);
        Assert.Equal(340m, order.Total); // 2 x 120 + 100 shipping, worked out by the server
        Assert.Equal(100m, order.ShippingFee);
        Assert.Equal("01012345678", order.Phone); // the phone is stored in one standard form
        Assert.Equal(3, Stock(productId));

        var cart = (await client.GetFromJsonAsync<CartDto>("/api/cart"))!;
        Assert.Empty(cart.Items); // the cart is emptied by the order
    }

    [Fact]
    public async Task The_total_comes_from_the_database_whatever_the_client_sends()
    {
        var productId = factory.AddProduct();
        var client = await factory.ClientFor(factory.AddUser());
        await AddToCart(client, productId, 1);

        var placed = await client.PostAsJsonAsync(
            "/api/orders",
            new
            {
                shippingName = "Ana Test",
                phone = "01012345678",
                address = "12 Nile St, Dokki",
                city = "Giza",
                total = 1,
                status = "Delivered",
                userId = 999,
            }
        );

        var order = (await placed.Content.ReadFromJsonAsync<OrderDto>())!;
        Assert.Equal(220m, order.Total); // 120 + 100 shipping
        Assert.Equal("Placed", order.Status);
    }

    [Fact]
    public async Task The_cart_shows_the_shipping_fee_and_the_total_to_pay()
    {
        var productId = factory.AddProduct();
        var client = await factory.ClientFor(factory.AddUser());

        var empty = (await client.GetFromJsonAsync<CartDto>("/api/cart"))!;
        await AddToCart(client, productId, 2);
        var cart = (await client.GetFromJsonAsync<CartDto>("/api/cart"))!;

        Assert.Equal(0m, empty.ShippingFee); // nothing to ship yet
        Assert.Equal(0m, empty.Total);
        Assert.Equal(240m, cart.Subtotal);
        Assert.Equal(100m, cart.ShippingFee);
        Assert.Equal(340m, cart.Total);
    }

    [Fact]
    public async Task The_fee_is_a_setting_and_an_order_keeps_the_fee_it_was_placed_with()
    {
        using var free = new ApiFactory(services =>
            services.Configure<CraftyCorner.Api.Services.ShopOptions>(o => o.ShippingFee = 0)
        );
        var productId = free.AddProduct();
        var client = await free.ClientFor(free.AddUser());
        await AddToCart(client, productId, 1);

        var placed = await client.PostAsJsonAsync("/api/orders", Order());

        var order = (await placed.Content.ReadFromJsonAsync<OrderDto>())!;
        Assert.Equal(0m, order.ShippingFee);
        Assert.Equal(120m, order.Total);
        Assert.Equal(0m, free.WithDb(db => db.Orders.Single().ShippingFee));
    }

    [Fact]
    public async Task An_empty_cart_cannot_be_ordered()
    {
        var client = await factory.ClientFor(factory.AddUser());

        var response = await client.PostAsJsonAsync("/api/orders", Order());

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("12345")]
    [InlineData("abc")]
    [InlineData("0212345678")]
    public async Task A_bad_phone_number_is_refused_and_nothing_is_taken_from_stock(string phone)
    {
        var productId = factory.AddProduct(stock: 5);
        var client = await factory.ClientFor(factory.AddUser());
        await AddToCart(client, productId, 1);

        var response = await client.PostAsJsonAsync("/api/orders", Order(phone));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(5, Stock(productId));
    }

    [Fact]
    public async Task If_stock_ran_out_after_adding_to_the_cart_the_order_is_refused_with_409()
    {
        var productId = factory.AddProduct(stock: 5);
        var userId = factory.AddUser();
        var client = await factory.ClientFor(userId);
        await AddToCart(client, productId, 3);

        factory.WithDb(db =>
        {
            db.Products.Single(p => p.Id == productId).StockQuantity = 1;
            return db.SaveChanges();
        });
        var response = await client.PostAsJsonAsync("/api/orders", Order());

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(1, Stock(productId));
        Assert.Equal(0, factory.WithDb(db => db.Orders.Count(o => o.UserId == userId)));
    }

    [Fact]
    public async Task A_hidden_product_cannot_be_ordered()
    {
        var productId = factory.AddProduct(stock: 5);
        var client = await factory.ClientFor(factory.AddUser());
        await AddToCart(client, productId, 1);

        factory.WithDb(db =>
        {
            db.Products.Single(p => p.Id == productId).IsActive = false;
            return db.SaveChanges();
        });

        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/orders", Order())).StatusCode);
    }

    [Fact]
    public async Task The_last_item_goes_to_one_buyer_only()
    {
        var productId = factory.AddProduct(stock: 1);
        var first = await factory.ClientFor(factory.AddUser());
        var second = await factory.ClientFor(factory.AddUser());
        await AddToCart(first, productId, 1);
        await AddToCart(second, productId, 1);

        var one = await first.PostAsJsonAsync("/api/orders", Order());
        var two = await second.PostAsJsonAsync("/api/orders", Order());

        Assert.Equal(HttpStatusCode.Created, one.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, two.StatusCode);
        Assert.Equal(0, Stock(productId));
    }

    [Fact]
    public async Task Cancelling_puts_the_stock_back_once_and_a_second_cancel_is_refused()
    {
        var productId = factory.AddProduct(stock: 5);
        var client = await factory.ClientFor(factory.AddUser());
        await AddToCart(client, productId, 2);
        var order = (await (await client.PostAsJsonAsync("/api/orders", Order())).Content.ReadFromJsonAsync<OrderDto>())!;
        Assert.Equal(3, Stock(productId));

        var first = await client.PostAsync($"/api/orders/{order.Id}/cancel", null);
        var second = await client.PostAsync($"/api/orders/{order.Id}/cancel", null);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        Assert.Equal(5, Stock(productId));
    }

    [Fact]
    public async Task Another_customer_cannot_read_or_cancel_my_order()
    {
        var productId = factory.AddProduct(stock: 5);
        var mine = await factory.ClientFor(factory.AddUser());
        var theirs = await factory.ClientFor(factory.AddUser());
        await AddToCart(mine, productId, 1);
        var order = (await (await mine.PostAsJsonAsync("/api/orders", Order())).Content.ReadFromJsonAsync<OrderDto>())!;

        // 404 (not 403): the other customer cannot even tell that the order exists
        Assert.Equal(HttpStatusCode.NotFound, (await theirs.GetAsync($"/api/orders/{order.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await theirs.PostAsync($"/api/orders/{order.Id}/cancel", null)).StatusCode);

        var list = (await theirs.GetFromJsonAsync<List<OrderSummaryDto>>("/api/orders"))!;
        Assert.Empty(list);
        Assert.Equal(HttpStatusCode.OK, (await mine.GetAsync($"/api/orders/{order.Id}")).StatusCode);
        Assert.Equal(4, Stock(productId)); // still taken: the cancel attempt did nothing
    }

    [Fact]
    public async Task The_owner_moves_an_order_to_delivered_and_only_then_can_the_customer_review()
    {
        var productId = factory.AddProduct(stock: 5);
        var customer = await factory.ClientFor(factory.AddUser());
        var admin = await factory.ClientFor(factory.AddUser(UserRole.Admin));
        await AddToCart(customer, productId, 1);
        var order = (await (await customer.PostAsJsonAsync("/api/orders", Order())).Content.ReadFromJsonAsync<OrderDto>())!;

        var review = new SaveReviewDto(5, "Lovely");
        Assert.Equal(HttpStatusCode.Forbidden, (await customer.PutAsJsonAsync($"/api/products/{productId}/reviews", review)).StatusCode);

        foreach (var status in new[] { "Confirmed", "Preparing", "Shipped", "Delivered" })
            Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync($"/api/admin/orders/{order.Id}/status", new { status })).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await customer.PutAsJsonAsync($"/api/products/{productId}/reviews", review)).StatusCode);
        var summary = (await customer.GetFromJsonAsync<ReviewSummaryDto>($"/api/products/{productId}/reviews"))!;
        Assert.Equal(1, summary.Count);
        Assert.Equal("Test U.", summary.Items.Single().AuthorName);
    }

    [Fact]
    public async Task A_delivered_order_cannot_be_moved_back_or_cancelled_by_the_owner()
    {
        var productId = factory.AddProduct(stock: 5);
        var customer = await factory.ClientFor(factory.AddUser());
        var admin = await factory.ClientFor(factory.AddUser(UserRole.Admin));
        await AddToCart(customer, productId, 1);
        var order = (await (await customer.PostAsJsonAsync("/api/orders", Order())).Content.ReadFromJsonAsync<OrderDto>())!;
        foreach (var status in new[] { "Confirmed", "Preparing", "Shipped", "Delivered" })
            await admin.PostAsJsonAsync($"/api/admin/orders/{order.Id}/status", new { status });

        var back = await admin.PostAsJsonAsync($"/api/admin/orders/{order.Id}/status", new { status = "Placed" });
        var cancel = await admin.PostAsJsonAsync($"/api/admin/orders/{order.Id}/status", new { status = "Cancelled" });

        Assert.Equal(HttpStatusCode.Conflict, back.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, cancel.StatusCode);
        Assert.Equal(4, Stock(productId)); // stock is not given back for a delivered order
    }

    [Fact]
    public async Task Each_customer_has_their_own_cart_and_wishlist()
    {
        var productId = factory.AddProduct();
        var ana = await factory.ClientFor(factory.AddUser());
        var omar = await factory.ClientFor(factory.AddUser());

        await AddToCart(ana, productId, 2);
        await ana.PutAsync($"/api/wishlist/{productId}", null);

        var omarCart = (await omar.GetFromJsonAsync<CartDto>("/api/cart"))!;
        var omarWishlist = (await omar.GetFromJsonAsync<List<ProductListDto>>("/api/wishlist"))!;
        Assert.Empty(omarCart.Items);
        Assert.Empty(omarWishlist);
        Assert.Single((await ana.GetFromJsonAsync<List<ProductListDto>>("/api/wishlist"))!);
    }
}
