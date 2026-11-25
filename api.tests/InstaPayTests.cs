using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.Extensions.DependencyInjection;
using CraftyCorner.Api.Controllers;
using CraftyCorner.Api.Dtos;
using CraftyCorner.Api.Models;
using CraftyCorner.Api.Services;

namespace CraftyCorner.Api.Tests;

/// <summary>Paying by InstaPay: the receipt upload, the order, who may see the screenshot, and the owner's review.</summary>
public class InstaPayTests
{
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4, 5, 6, 7, 8];

    /// <summary>The application with InstaPay switched on (it is off until the shop sets its address).</summary>
    private static ApiFactory WithInstaPay() =>
        new(services => services.Configure<ShopOptions>(o => o.InstaPay.Handle = "craftycorner@instapay"));

    private static MultipartFormDataContent Upload(byte[] bytes, string name = "receipt.png")
    {
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new("image/png");
        return new MultipartFormDataContent { { file, "file", name } };
    }

    private static async Task<string> UploadReceipt(HttpClient client)
    {
        var response = await client.PostAsync("/api/payments/receipts", Upload(Png));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ReceiptUploadedDto>())!.ReceiptId;
    }

    private static Task<HttpResponseMessage> AddToCart(HttpClient client, int productId) =>
        client.PostAsJsonAsync("/api/cart/items", new AddCartItemDto(productId, 1));

    private static Task<HttpResponseMessage> Place(HttpClient client, string? method, string? receiptId, string? reference = null) =>
        client.PostAsJsonAsync(
            "/api/orders",
            new
            {
                shippingName = "Ana Test",
                phone = "01012345678",
                address = "12 Nile St, Dokki",
                city = "Giza",
                paymentMethod = method,
                receiptId,
                paymentReference = reference,
            }
        );

    private static async Task<OrderDto> PlaceInstaPay(ApiFactory factory, HttpClient client, string? reference = "IP-1001")
    {
        await AddToCart(client, factory.AddProduct(stock: 5));
        var receipt = await UploadReceipt(client);
        var response = await Place(client, "InstaPay", receipt, reference);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<OrderDto>())!;
    }

    private static Task<HttpResponseMessage> Review(HttpClient admin, int orderId, string decision, string? note = null) =>
        admin.PostAsJsonAsync($"/api/admin/orders/{orderId}/payment", new PaymentDecisionDto(decision, note));

    // ---------- the upload

    [Fact]
    public async Task A_customer_uploads_a_receipt_image_and_gets_an_id_back()
    {
        using var factory = WithInstaPay();
        var client = await factory.ClientFor(factory.AddUser());

        var id = await UploadReceipt(client);

        Assert.True(ReceiptStore.IsValidId(id));
        Assert.EndsWith(".png", id);
    }

    [Fact]
    public async Task Only_real_images_under_five_megabytes_are_accepted_as_receipts()
    {
        using var factory = WithInstaPay();
        var client = await factory.ClientFor(factory.AddUser());
        var script = Encoding.UTF8.GetBytes("<script>alert(1)</script> not an image at all");
        var big = new byte[5 * 1024 * 1024 + 100];
        Png.CopyTo(big, 0);

        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync("/api/payments/receipts", Upload(script))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync("/api/payments/receipts", Upload(big))).StatusCode);
    }

    [Fact]
    public async Task Uploading_a_receipt_needs_a_signed_in_customer()
    {
        using var factory = WithInstaPay();

        var response = await factory.CreateClient().PostAsync("/api/payments/receipts", Upload(Png));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ---------- placing the order

    [Fact]
    public async Task InstaPay_is_refused_while_the_shop_has_not_set_it_up()
    {
        using var factory = new ApiFactory(); // no InstaPay address configured
        var client = await factory.ClientFor(factory.AddUser());
        await AddToCart(client, factory.AddProduct());

        var response = await Place(client, "InstaPay", "0123456789abcdef0123456789abcdef.png");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var shop = await factory.CreateClient().GetFromJsonAsync<ShopInfoDto>("/api/shop");
        Assert.Null(shop!.InstaPay);
    }

    [Fact]
    public async Task The_storefront_learns_where_to_send_the_money()
    {
        using var factory = WithInstaPay();

        var shop = await factory.CreateClient().GetFromJsonAsync<ShopInfoDto>("/api/shop");

        Assert.Equal("craftycorner@instapay", shop!.InstaPay!.Handle);
    }

    [Fact]
    public async Task An_InstaPay_order_needs_a_receipt_of_the_customers_own()
    {
        using var factory = WithInstaPay();
        var productId = factory.AddProduct(stock: 5);
        var ana = await factory.ClientFor(factory.AddUser());
        var omar = await factory.ClientFor(factory.AddUser());
        await AddToCart(ana, productId);
        var omarsReceipt = await UploadReceipt(omar);

        var none = await Place(ana, "InstaPay", null);
        var garbage = await Place(ana, "InstaPay", "../../etc/passwd");
        var notMine = await Place(ana, "InstaPay", omarsReceipt); // somebody else's upload

        Assert.Equal(HttpStatusCode.BadRequest, none.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, garbage.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, notMine.StatusCode);
        Assert.Equal(0, factory.WithDb(db => db.Orders.Count()));
    }

    [Fact]
    public async Task An_InstaPay_order_waits_for_review_and_keeps_the_reference()
    {
        using var factory = WithInstaPay();
        var client = await factory.ClientFor(factory.AddUser());

        var order = await PlaceInstaPay(factory, client, "IP-7788");

        Assert.Equal("InstaPay", order.PaymentMethod);
        Assert.Equal("AwaitingReview", order.PaymentStatus);
        Assert.Equal("IP-7788", order.PaymentReference);
        Assert.True(order.HasReceipt);
        Assert.Equal(220m, order.Total); // the fee is part of what is transferred
    }

    [Fact]
    public async Task One_receipt_cannot_pay_for_two_orders()
    {
        using var factory = WithInstaPay();
        var client = await factory.ClientFor(factory.AddUser());
        var first = await PlaceInstaPay(factory, client);
        var receipt = factory.WithDb(db => db.Orders.Single(o => o.Id == first.Id).PaymentReceipt);
        var productId = factory.AddProduct(stock: 5);
        await AddToCart(client, productId);

        var second = await Place(client, "InstaPay", receipt);

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        Assert.Equal(5, factory.WithDb(db => db.Products.Single(p => p.Id == productId).StockQuantity)); // nothing was taken
    }

    [Fact]
    public async Task Cash_on_delivery_is_unchanged_and_has_nothing_to_review()
    {
        using var factory = WithInstaPay();
        var client = await factory.ClientFor(factory.AddUser());
        var admin = await factory.ClientFor(factory.AddUser(UserRole.Admin));
        await AddToCart(client, factory.AddProduct());

        var placed = await Place(client, null, null);
        var order = (await placed.Content.ReadFromJsonAsync<OrderDto>())!;

        Assert.Equal("CashOnDelivery", order.PaymentMethod);
        Assert.Equal("None", order.PaymentStatus);
        Assert.False(order.HasReceipt);
        Assert.Equal(HttpStatusCode.Conflict, (await Review(admin, order.Id, "confirm")).StatusCode);
    }

    // ---------- who can see the screenshot

    [Fact]
    public async Task The_screenshot_is_private_to_its_customer_and_the_owner()
    {
        using var factory = WithInstaPay();
        var ana = await factory.ClientFor(factory.AddUser());
        var omar = await factory.ClientFor(factory.AddUser());
        var admin = await factory.ClientFor(factory.AddUser(UserRole.Admin));
        var order = await PlaceInstaPay(factory, ana);

        var mine = await ana.GetAsync($"/api/orders/{order.Id}/receipt");
        var theirs = await omar.GetAsync($"/api/orders/{order.Id}/receipt");
        var anonymous = await factory.CreateClient().GetAsync($"/api/orders/{order.Id}/receipt");
        var owner = await admin.GetAsync($"/api/admin/orders/{order.Id}/receipt");
        var customerOnAdminRoute = await ana.GetAsync($"/api/admin/orders/{order.Id}/receipt");

        Assert.Equal(HttpStatusCode.OK, mine.StatusCode);
        Assert.Equal("image/png", mine.Content.Headers.ContentType!.MediaType);
        Assert.Contains("no-store", mine.Headers.CacheControl!.ToString());
        Assert.Equal(Png, await mine.Content.ReadAsByteArrayAsync());
        Assert.Equal(HttpStatusCode.NotFound, theirs.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
        Assert.Equal(HttpStatusCode.OK, owner.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, customerOnAdminRoute.StatusCode);
    }

    [Fact]
    public async Task Receipts_are_not_served_as_public_files()
    {
        using var factory = WithInstaPay();
        var client = await factory.ClientFor(factory.AddUser());
        var id = await UploadReceipt(client);

        var asStatic = await factory.CreateClient().GetAsync($"/uploads/{id}");
        var guessed = await factory.CreateClient().GetAsync($"/receipts/{id}");

        Assert.NotEqual(HttpStatusCode.OK, asStatic.StatusCode);
        Assert.NotEqual(HttpStatusCode.OK, guessed.StatusCode);
    }

    // ---------- the owner's review

    [Fact]
    public async Task The_order_cannot_move_on_until_the_owner_confirms_the_payment()
    {
        using var factory = WithInstaPay();
        var client = await factory.ClientFor(factory.AddUser());
        var admin = await factory.ClientFor(factory.AddUser(UserRole.Admin));
        var order = await PlaceInstaPay(factory, client);

        var early = await admin.PostAsJsonAsync($"/api/admin/orders/{order.Id}/status", new { status = "Confirmed" });
        var review = await Review(admin, order.Id, "confirm");
        var later = await admin.PostAsJsonAsync($"/api/admin/orders/{order.Id}/status", new { status = "Confirmed" });

        Assert.Equal(HttpStatusCode.Conflict, early.StatusCode);
        Assert.Equal(HttpStatusCode.OK, review.StatusCode);
        Assert.Equal("Confirmed", (await review.Content.ReadFromJsonAsync<OrderDto>())!.PaymentStatus);
        Assert.Equal(HttpStatusCode.OK, later.StatusCode);
    }

    [Fact]
    public async Task A_rejected_receipt_can_be_replaced_and_then_reviewed_again()
    {
        using var factory = WithInstaPay();
        var client = await factory.ClientFor(factory.AddUser());
        var admin = await factory.ClientFor(factory.AddUser(UserRole.Admin));
        var order = await PlaceInstaPay(factory, client);

        var rejected = (await (await Review(admin, order.Id, "reject", "The amount is not 220")).Content.ReadFromJsonAsync<OrderDto>())!;
        Assert.Equal("Rejected", rejected.PaymentStatus);
        Assert.Equal("The amount is not 220", rejected.PaymentNote);
        Assert.Equal(HttpStatusCode.Conflict, (await Review(admin, order.Id, "confirm")).StatusCode); // nothing new to review yet

        var newReceipt = await UploadReceipt(client);
        var replaced = await client.PutAsJsonAsync($"/api/orders/{order.Id}/receipt", new ReplaceReceiptDto(newReceipt, "IP-2002"));

        Assert.Equal(HttpStatusCode.OK, replaced.StatusCode);
        var dto = (await replaced.Content.ReadFromJsonAsync<OrderDto>())!;
        Assert.Equal("AwaitingReview", dto.PaymentStatus);
        Assert.Null(dto.PaymentNote);
        Assert.Equal("IP-2002", dto.PaymentReference);
        Assert.Equal(HttpStatusCode.OK, (await Review(admin, order.Id, "confirm")).StatusCode);
    }

    [Fact]
    public async Task A_rejection_without_a_reason_still_gives_the_customer_one_and_bad_decisions_are_refused()
    {
        using var factory = WithInstaPay();
        var client = await factory.ClientFor(factory.AddUser());
        var admin = await factory.ClientFor(factory.AddUser(UserRole.Admin));
        var order = await PlaceInstaPay(factory, client);

        Assert.Equal(HttpStatusCode.BadRequest, (await Review(admin, order.Id, "maybe")).StatusCode);
        var rejected = (await (await Review(admin, order.Id, "reject")).Content.ReadFromJsonAsync<OrderDto>())!;

        Assert.False(string.IsNullOrWhiteSpace(rejected.PaymentNote));
    }

    [Fact]
    public async Task Only_the_owner_reviews_payments()
    {
        using var factory = WithInstaPay();
        var client = await factory.ClientFor(factory.AddUser());
        var order = await PlaceInstaPay(factory, client);

        var byCustomer = await Review(client, order.Id, "confirm");
        var byVisitor = await Review(factory.CreateClient(), order.Id, "confirm");

        Assert.Equal(HttpStatusCode.Forbidden, byCustomer.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, byVisitor.StatusCode);
    }

    [Fact]
    public async Task A_paid_order_is_cancelled_through_the_owner_not_by_the_customer_alone()
    {
        using var factory = WithInstaPay();
        var client = await factory.ClientFor(factory.AddUser());
        var admin = await factory.ClientFor(factory.AddUser(UserRole.Admin));
        var order = await PlaceInstaPay(factory, client);
        await Review(admin, order.Id, "confirm");

        var byCustomer = await client.PostAsync($"/api/orders/{order.Id}/cancel", null);

        Assert.Equal(HttpStatusCode.Conflict, byCustomer.StatusCode);
    }

    [Fact]
    public async Task A_customer_cannot_change_the_receipt_of_an_order_that_is_already_paid()
    {
        using var factory = WithInstaPay();
        var client = await factory.ClientFor(factory.AddUser());
        var admin = await factory.ClientFor(factory.AddUser(UserRole.Admin));
        var order = await PlaceInstaPay(factory, client);
        await Review(admin, order.Id, "confirm");
        var receipt = await UploadReceipt(client);

        var response = await client.PutAsJsonAsync($"/api/orders/{order.Id}/receipt", new ReplaceReceiptDto(receipt));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }
}
