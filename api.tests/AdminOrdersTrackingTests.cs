using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using CraftyCorner.Api.Controllers;
using CraftyCorner.Api.Dtos;
using CraftyCorner.Api.Models;
using CraftyCorner.Api.Services;

namespace CraftyCorner.Api.Tests;

public class AdminOrdersTrackingTests : IDisposable
{
    private readonly TestDb t = new();
    private readonly FakeEmailQueue emails = new();

    public void Dispose() => t.Dispose();

    private sealed class FakeEmailQueue : IEmailQueue
    {
        public List<EmailMessage> Sent { get; } = [];

        public bool Enabled => true;

        public ValueTask EnqueueAsync(EmailMessage message)
        {
            Sent.Add(message);
            return ValueTask.CompletedTask;
        }
    }

    private AdminOrdersController Admin() =>
        TestDb.SignedInAs(
            new AdminOrdersController(
                t.Db,
                TimeProvider.System,
                emails,
                Options.Create(new EmailOptions { WebUrl = "https://shop.test" }),
                NullLogger<AdminOrdersController>.Instance
            ),
            userId: 1,
            role: "Admin"
        );

    private (Order order, User user) ShippedOrder(OrderStatus status = OrderStatus.Shipped)
    {
        var user = t.AddUser();
        var product = t.AddProduct();
        return (t.AddOrder(user, product, status), user);
    }

    [Fact]
    public async Task SetTracking_saves_the_courier_and_number_and_returns_them()
    {
        var (order, _) = ShippedOrder(OrderStatus.Preparing);

        var result = await Admin().SetTracking(order.Id, new UpdateTrackingDto("  Bosta ", " 12345 "));

        var dto = result.Value!;
        Assert.Equal("Bosta", dto.TrackingCompany);
        Assert.Equal("12345", dto.TrackingNumber);
        Assert.Equal("12345", t.New().Orders.Single().TrackingNumber);
    }

    [Fact]
    public async Task SetTracking_with_blank_values_clears_them()
    {
        var (order, _) = ShippedOrder();
        await Admin().SetTracking(order.Id, new UpdateTrackingDto("Bosta", "999"));

        var result = await Admin().SetTracking(order.Id, new UpdateTrackingDto(" ", null));

        Assert.Null(result.Value!.TrackingCompany);
        Assert.Null(result.Value.TrackingNumber);
    }

    [Fact]
    public async Task SetTracking_is_404_for_an_unknown_order_and_409_for_a_cancelled_one()
    {
        var (cancelled, _) = ShippedOrder(OrderStatus.Cancelled);

        Assert.IsType<NotFoundResult>((await Admin().SetTracking(9999, new UpdateTrackingDto("A", "1"))).Result);

        var conflict = Assert.IsType<ObjectResult>((await Admin().SetTracking(cancelled.Id, new UpdateTrackingDto("A", "1"))).Result);
        Assert.Equal(409, conflict.StatusCode);
    }

    [Fact]
    public async Task A_delivered_order_keeps_its_shipment_details()
    {
        var (order, _) = ShippedOrder(OrderStatus.Shipped);
        await Admin().SetTracking(order.Id, new UpdateTrackingDto("Bosta", "AB-1"));
        await Admin().SetStatus(order.Id, new UpdateOrderStatusDto("Delivered"));
        t.Db.ChangeTracker.Clear(); // the next request would read the order again from the database

        var result = await Admin().SetTracking(order.Id, new UpdateTrackingDto("Other", "ZZ-9"));

        var conflict = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(409, conflict.StatusCode);
        Assert.Equal("AB-1", t.New().Orders.Single().TrackingNumber);
    }

    [Fact]
    public async Task A_shipped_order_emails_the_customer_the_tracking_number_once()
    {
        var (order, user) = ShippedOrder(OrderStatus.Shipped);

        await Admin().SetTracking(order.Id, new UpdateTrackingDto("Bosta", "AB-777"));

        var mail = Assert.Single(emails.Sent);
        Assert.Equal(user.Email, mail.To);
        Assert.Contains("AB-777", mail.Body);
        Assert.Contains("Bosta", mail.Body);
        Assert.Contains("https://shop.test/orders/" + order.Id, mail.Body);

        // saving the same details again is not a change, so no second email
        await Admin().SetTracking(order.Id, new UpdateTrackingDto("Bosta", "AB-777"));
        Assert.Single(emails.Sent);
    }

    [Fact]
    public async Task Tracking_on_an_order_that_is_not_shipped_yet_sends_no_email()
    {
        var (order, _) = ShippedOrder(OrderStatus.Preparing);

        await Admin().SetTracking(order.Id, new UpdateTrackingDto("Bosta", "AB-777"));

        Assert.Empty(emails.Sent);
    }

    [Fact]
    public async Task Moving_an_order_to_Shipped_emails_the_customer_with_the_saved_tracking()
    {
        var (order, user) = ShippedOrder(OrderStatus.Preparing);
        await Admin().SetTracking(order.Id, new UpdateTrackingDto("Aramex", "ZX-1"));

        var result = await Admin().SetStatus(order.Id, new UpdateOrderStatusDto("Shipped"));

        Assert.Equal("Shipped", result.Value!.Status);
        var mail = Assert.Single(emails.Sent);
        Assert.Equal(user.Email, mail.To);
        Assert.Contains("ZX-1", mail.Body);
    }
}
