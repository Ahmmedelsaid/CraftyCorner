using System.ComponentModel.DataAnnotations;
using CraftyCorner.Api.Models;

namespace CraftyCorner.Api.Dtos;

public record PlaceOrderDto(
    [Required, StringLength(100, MinimumLength = 2)] string ShippingName,
    [Required, EgyptPhone] string Phone,
    [Required, StringLength(300, MinimumLength = 5)] string Address,
    [Required, StringLength(100, MinimumLength = 2)] string City,
    [StringLength(500)] string? Notes,
    [Range(-90, 90)] double? Latitude = null,
    [Range(-180, 180)] double? Longitude = null,
    // "CashOnDelivery" (the default) or "InstaPay"; InstaPay needs the id of an uploaded receipt
    string? PaymentMethod = null,
    string? ReceiptId = null,
    [StringLength(60)] string? PaymentReference = null
);

public record ReplaceReceiptDto(
    [Required] string ReceiptId,
    [StringLength(60)] string? PaymentReference = null
);

public record PaymentDecisionDto(
    // "confirm" or "reject"
    [Required] string Decision,
    [StringLength(300)] string? Note = null
);

public record OrderItemDto(
    int ProductId,
    string Name,
    string? ImageUrl,
    decimal UnitPrice,
    int Quantity,
    decimal LineTotal,
    string? NameEn = null
);

public record OrderDto(
    int Id,
    string Status,
    decimal Total,
    int ItemCount,
    DateTime CreatedAt,
    DateTime? CancelledAt,
    string ShippingName,
    string Phone,
    string Address,
    string City,
    string? Notes,
    double? Latitude,
    double? Longitude,
    IReadOnlyList<OrderItemDto> Items,
    string? TrackingCompany = null,
    string? TrackingNumber = null,
    decimal ShippingFee = 0,
    string PaymentMethod = "CashOnDelivery",
    string PaymentStatus = "None",
    string? PaymentReference = null,
    string? PaymentNote = null,
    bool HasReceipt = false
)
{
    public static OrderDto From(Order order) =>
        new(
            order.Id,
            order.Status.ToString(),
            order.Total,
            order.Items.Sum(i => i.Quantity),
            order.CreatedAt,
            order.CancelledAt,
            order.ShippingName,
            order.Phone,
            order.Address,
            order.City,
            order.Notes,
            order.Latitude,
            order.Longitude,
            [
                .. order.Items.Select(i => new OrderItemDto(
                    i.ProductId,
                    i.ProductName,
                    i.ImageUrl,
                    i.UnitPrice,
                    i.Quantity,
                    i.UnitPrice * i.Quantity,
                    i.Product?.NameEn
                )),
            ],
            order.TrackingCompany,
            order.TrackingNumber,
            order.ShippingFee,
            order.PaymentMethod.ToString(),
            order.PaymentStatus.ToString(),
            order.PaymentReference,
            order.PaymentNote,
            order.PaymentReceipt is not null
        );
}

/// <summary>A row of the order history: a few thumbnails instead of every line.</summary>
public record OrderSummaryDto(
    int Id,
    string Status,
    decimal Total,
    int ItemCount,
    DateTime CreatedAt,
    IReadOnlyList<string> ImageUrls
);
