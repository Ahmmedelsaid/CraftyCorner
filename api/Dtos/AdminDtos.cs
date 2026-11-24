using System.ComponentModel.DataAnnotations;
using CraftyCorner.Api.Models;

namespace CraftyCorner.Api.Dtos;

/// <summary>A row of the owner's product table (includes hidden products and the stock level).</summary>
public record AdminProductListDto(
    int Id,
    string Name,
    string Sku,
    decimal Price,
    int StockQuantity,
    bool IsActive,
    string? ImageUrl,
    string CategoryName,
    int CategoryId
);

/// <summary>A row of the owner's order table.</summary>
public record AdminOrderListDto(
    int Id,
    string Status,
    decimal Total,
    int ItemCount,
    DateTime CreatedAt,
    string ShippingName,
    string Phone,
    string City
);

public record UpdateOrderStatusDto([Required] string Status);

public record AdminMessageDto(
    int Id,
    string Name,
    string Email,
    string? Phone,
    string Subject,
    string Message,
    string Topic,
    int? OrderNumber,
    bool IsRead,
    DateTime CreatedAt
)
{
    public static AdminMessageDto From(ContactMessage m) =>
        new(m.Id, m.Name, m.Email, m.Phone, m.Subject, m.Message, m.Topic, m.OrderNumber, m.IsRead, m.CreatedAt);
}

public record DailyOrdersDto(DateOnly Date, int Orders);

public record LowStockDto(int Id, string Name, int StockQuantity, string? ImageUrl);

public record AdminStatsDto(
    Dictionary<string, int> OrdersByStatus,
    int OrdersToday,
    decimal DeliveredRevenue,
    decimal OpenOrdersValue,
    int ActiveProducts,
    int UnreadMessages,
    IReadOnlyList<LowStockDto> LowStock,
    IReadOnlyList<DailyOrdersDto> Last7Days
);

public record UploadResultDto(string Url);
