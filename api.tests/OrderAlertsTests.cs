using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using CraftyCorner.Api.Dtos;
using CraftyCorner.Api.Models;
using CraftyCorner.Api.Services;

namespace CraftyCorner.Api.Tests;

public class OrderAlertsTests
{
    private sealed class RecordingHandler(HttpStatusCode status = HttpStatusCode.OK, bool fail = false) : HttpMessageHandler
    {
        public List<(Uri Url, string Body)> Requests { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (fail)
                throw new HttpRequestException($"could not reach {request.RequestUri}");
            Requests.Add((request.RequestUri!, await request.Content!.ReadAsStringAsync(cancellationToken)));
            return new HttpResponseMessage(status);
        }
    }

    private static TelegramOrderAlerts Alerts(HttpMessageHandler handler, string? token = "123:SECRET", string? chat = "555", string? adminUrl = "https://admin.shop.test/")
    {
        var options = Options.Create(
            new NotificationOptions
            {
                AdminUrl = adminUrl,
                Telegram = new TelegramOptions { BotToken = token, ChatId = chat },
            }
        );
        return new TelegramOrderAlerts(new HttpClient(handler), options, NullLogger<TelegramOrderAlerts>.Instance);
    }

    private static Order SampleOrder() =>
        new()
        {
            Id = 42,
            ShippingName = "Ana\nTest",
            Phone = "01012345678",
            Address = "12 Nile St",
            City = "Giza",
            Notes = "Ring twice <b>please</b>",
            Total = 480.5m,
            Latitude = 30.0131,
            Longitude = 31.2089,
            Items =
            [
                new OrderItem { ProductName = "Crescent Set", Quantity = 2 },
                new OrderItem { ProductName = "Vase", Quantity = 1 },
            ],
        };

    [Fact]
    public void Alerts_are_off_without_a_token_or_a_chat()
    {
        var handler = new RecordingHandler();

        Assert.False(Alerts(handler, token: null).Enabled);
        Assert.False(Alerts(handler, chat: " ").Enabled);
        Assert.True(Alerts(handler).Enabled);
    }

    [Fact]
    public async Task A_new_order_is_sent_to_the_bot_with_the_chat_and_a_readable_text()
    {
        var handler = new RecordingHandler();

        await Alerts(handler).NewOrderAsync(SampleOrder(), "ana@example.com");

        var (url, body) = Assert.Single(handler.Requests);
        Assert.Equal("https://api.telegram.org/bot123:SECRET/sendMessage", url.ToString());
        var json = JsonDocument.Parse(body).RootElement;
        Assert.Equal("555", json.GetProperty("chat_id").GetString());
        var text = json.GetProperty("text").GetString()!;
        Assert.Contains("New order #42 - 480.5 EGP", text);
        Assert.Contains("01012345678", text);
        Assert.Contains("2 x Crescent Set", text);
        Assert.Contains("12 Nile St, Giza", text);
        Assert.Contains("https://www.openstreetmap.org/?mlat=30.0131&mlon=31.2089", text);
        Assert.Contains("ana@example.com", text);
        Assert.Contains("Open: https://admin.shop.test/orders/42", text);
    }

    [Fact]
    public async Task The_text_is_plain_so_what_a_customer_types_cannot_change_the_formatting()
    {
        var handler = new RecordingHandler();

        await Alerts(handler).NewOrderAsync(SampleOrder(), "ana@example.com");

        var json = JsonDocument.Parse(handler.Requests.Single().Body).RootElement;
        Assert.False(json.TryGetProperty("parse_mode", out _)); // no Markdown or HTML mode
        var text = json.GetProperty("text").GetString()!;
        Assert.Contains("Ana Test", text); // a line break in the name is flattened
        Assert.Contains("<b>please</b>", text); // shown as typed
    }

    [Fact]
    public void The_alert_lists_the_shipping_fee_only_when_there_is_one()
    {
        var order = SampleOrder();

        Assert.DoesNotContain("Shipping:", TelegramOrderAlerts.NewOrderText(order, "a@example.com", null));

        order.ShippingFee = 100;
        Assert.Contains("Shipping: 100 EGP", TelegramOrderAlerts.NewOrderText(order, "a@example.com", null));
    }

    [Fact]
    public void There_is_no_link_when_the_dashboard_address_is_not_set()
    {
        var text = TelegramOrderAlerts.NewOrderText(SampleOrder(), "ana@example.com", adminUrl: null);

        Assert.DoesNotContain("Open:", text);
    }

    [Fact]
    public async Task A_cancellation_is_reported()
    {
        var handler = new RecordingHandler();

        await Alerts(handler).OrderCancelledAsync(SampleOrder());

        var text = JsonDocument.Parse(handler.Requests.Single().Body).RootElement.GetProperty("text").GetString()!;
        Assert.Contains("Order #42 was cancelled", text);
    }

    [Fact]
    public async Task Nothing_is_sent_when_it_is_not_configured()
    {
        var handler = new RecordingHandler();

        await Alerts(handler, token: null).NewOrderAsync(SampleOrder(), "ana@example.com");

        Assert.Empty(handler.Requests);
    }

    [Fact]
    public async Task A_refusal_or_a_network_failure_never_throws()
    {
        await Alerts(new RecordingHandler(HttpStatusCode.Unauthorized)).NewOrderAsync(SampleOrder(), "a@example.com");
        await Alerts(new RecordingHandler(fail: true)).NewOrderAsync(SampleOrder(), "a@example.com");
    }

    // ---------- through the real application

    private sealed class FakeAlerts(bool throws = false) : IOrderAlerts
    {
        public List<int> NewOrders { get; } = [];
        public List<int> Cancelled { get; } = [];

        public bool Enabled => true;

        public Task NewOrderAsync(Order order, string customerEmail)
        {
            NewOrders.Add(order.Id);
            return throws ? Task.FromException(new InvalidOperationException("Telegram is down")) : Task.CompletedTask;
        }

        public Task OrderCancelledAsync(Order order)
        {
            Cancelled.Add(order.Id);
            return Task.CompletedTask;
        }
    }

    private static async Task<(HttpClient Client, int OrderId)> Order(ApiFactory factory)
    {
        var client = await factory.ClientFor(factory.AddUser());
        var productId = factory.AddProduct(stock: 5);
        await client.PostAsJsonAsync("/api/cart/items", new AddCartItemDto(productId, 1));
        var placed = await client.PostAsJsonAsync(
            "/api/orders",
            new { shippingName = "Ana Test", phone = "01012345678", address = "12 Nile St, Dokki", city = "Giza" }
        );
        Assert.Equal(HttpStatusCode.Created, placed.StatusCode);
        return (client, (await placed.Content.ReadFromJsonAsync<OrderDto>())!.Id);
    }

    [Fact]
    public async Task Placing_an_order_alerts_the_owner_once_and_cancelling_it_alerts_again()
    {
        var fake = new FakeAlerts();
        using var factory = new ApiFactory(services => services.AddSingleton<IOrderAlerts>(fake));

        var (client, orderId) = await Order(factory);

        Assert.Equal([orderId], fake.NewOrders);

        await client.PostAsync($"/api/orders/{orderId}/cancel", null);
        Assert.Equal([orderId], fake.Cancelled);
    }

    [Fact]
    public async Task If_the_alert_service_is_broken_the_customer_still_gets_their_order()
    {
        var fake = new FakeAlerts(throws: true);
        using var factory = new ApiFactory(services => services.AddSingleton<IOrderAlerts>(fake));

        var (_, orderId) = await Order(factory);

        Assert.Equal([orderId], fake.NewOrders);
        Assert.Equal(1, factory.WithDb(db => db.Orders.Count()));
    }
}
