using System.Globalization;
using System.Net.Http.Json;
using System.Text;
using Microsoft.Extensions.Options;
using CraftyCorner.Api.Models;

namespace CraftyCorner.Api.Services;

/// <summary>
/// Settings for the phone alert (section "Notifications"). The bot token is a secret: keep it in user-secrets
/// or an environment variable, never in git. With no token the alert is simply off.
/// </summary>
public class NotificationOptions
{
    public const string SectionName = "Notifications";

    /// <summary>Address of the owner dashboard (for example https://admin.example.com). Used for the link in the alert.</summary>
    public string? AdminUrl { get; set; }

    public TelegramOptions Telegram { get; set; } = new();
}

public class TelegramOptions
{
    /// <summary>The token @BotFather gives when you create the bot.</summary>
    public string? BotToken { get; set; }

    /// <summary>The chat that receives the alerts (your chat with the bot, or a group the bot is in).</summary>
    public string? ChatId { get; set; }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(BotToken) && !string.IsNullOrWhiteSpace(ChatId);
}

/// <summary>Tells the shop owner, on their phone, that something needs attention.</summary>
public interface IOrderAlerts
{
    bool Enabled { get; }

    /// <summary>Never throws: an alert that cannot be delivered is logged and forgotten.</summary>
    Task NewOrderAsync(Order order, string customerEmail);

    Task OrderCancelledAsync(Order order);

    /// <summary>The customer uploaded a new transfer receipt for an order (after a rejected one).</summary>
    Task ReceiptReplacedAsync(Order order);
}

/// <summary>Sends the alerts as Telegram messages (the Bot API is free).</summary>
public sealed class TelegramOrderAlerts(
    HttpClient http,
    IOptions<NotificationOptions> options,
    ILogger<TelegramOrderAlerts> logger
) : IOrderAlerts
{
    private NotificationOptions Settings => options.Value;

    public bool Enabled => Settings.Telegram.IsConfigured;

    public Task NewOrderAsync(Order order, string customerEmail) =>
        SendAsync(NewOrderText(order, customerEmail, Settings.AdminUrl), order.Id);

    public Task ReceiptReplacedAsync(Order order) =>
        SendAsync(
            $"Order #{order.Id}: a new InstaPay receipt is waiting for your review ({Money(order.Total)}).",
            order.Id
        );

    public Task OrderCancelledAsync(Order order) =>
        SendAsync(
            $"Order #{order.Id} was cancelled by the customer ({OneLine(order.ShippingName)}, {order.Phone}).",
            order.Id
        );

    /// <summary>
    /// Plain text on purpose (no Markdown or HTML mode): the customer's name, address and notes are typed by
    /// strangers, and must never be able to change how the message is formatted.
    /// </summary>
    public static string NewOrderText(Order order, string customerEmail, string? adminUrl)
    {
        var text = new StringBuilder();
        text.AppendLine($"New order #{order.Id} - {Money(order.Total)}");
        if (order.PaymentMethod == PaymentMethod.InstaPay)
            text.AppendLine("PAID BY INSTAPAY: the receipt is waiting for your review");
        text.AppendLine();
        text.AppendLine($"{OneLine(order.ShippingName)}  {order.Phone}");
        text.AppendLine($"{OneLine(order.Address)}, {OneLine(order.City)}");
        if (!string.IsNullOrWhiteSpace(order.Notes))
            text.AppendLine($"Notes: {OneLine(order.Notes)}");
        text.AppendLine();
        foreach (var item in order.Items)
            text.AppendLine($"{item.Quantity} x {OneLine(item.ProductName)}");
        if (order.ShippingFee > 0)
            text.AppendLine($"Shipping: {Money(order.ShippingFee)}");
        if (order.Latitude is { } lat && order.Longitude is { } lng)
        {
            text.AppendLine();
            text.AppendLine(
                string.Create(
                    CultureInfo.InvariantCulture,
                    $"Map: https://www.openstreetmap.org/?mlat={lat}&mlon={lng}#map=17/{lat}/{lng}"
                )
            );
        }
        text.AppendLine($"Email: {customerEmail}");
        if (!string.IsNullOrWhiteSpace(adminUrl))
        {
            text.AppendLine();
            text.AppendLine($"Open: {adminUrl.TrimEnd('/')}/orders/{order.Id}");
        }

        return text.ToString().TrimEnd();
    }

    private async Task SendAsync(string text, int orderId)
    {
        var telegram = Settings.Telegram;
        if (!telegram.IsConfigured)
            return;

        try
        {
            using var response = await http.PostAsJsonAsync(
                $"https://api.telegram.org/bot{telegram.BotToken}/sendMessage",
                new
                {
                    chat_id = telegram.ChatId,
                    text,
                    disable_web_page_preview = true,
                }
            );
            if (!response.IsSuccessStatusCode)
                // the status only: the body and the address contain the token or the chat
                logger.LogWarning(
                    "Telegram refused the alert for order {OrderId}: {Status}",
                    orderId,
                    (int)response.StatusCode
                );
        }
        catch (Exception ex)
        {
            // do not log the exception itself: its message contains the request address, which contains the token
            logger.LogWarning(
                "Could not send the Telegram alert for order {OrderId} ({Type})",
                orderId,
                ex.GetType().Name
            );
        }
    }

    private static string Money(decimal amount) =>
        amount.ToString("0.##", CultureInfo.InvariantCulture) + " EGP";

    private static string OneLine(string text) => text.ReplaceLineEndings(" ");
}
