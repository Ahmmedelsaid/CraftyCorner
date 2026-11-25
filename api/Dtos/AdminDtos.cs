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
    int CategoryId,
    string? NameEn
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
    string City,
    string PaymentMethod = "CashOnDelivery",
    string PaymentStatus = "None"
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

/// <summary>An owner account in the dashboard's Team page.</summary>
public record AdminUserDto(
    int Id,
    string Email,
    string FullName,
    bool IsActive,
    DateTime CreatedAt,
    bool IsCurrentUser
);

public record CreateAdminDto(
    [Required, EmailAddress, StringLength(254)] string Email,
    [Required, StringLength(100, MinimumLength = 2)] string FullName,
    [
        Required,
        StringLength(100, MinimumLength = 8),
        RegularExpression(
            ValidationPatterns.Password,
            ErrorMessage = ValidationPatterns.PasswordMessage
        )
    ]
        string Password
);

public record UpdateAdminDto(
    [Required, EmailAddress, StringLength(254)] string Email,
    [Required, StringLength(100, MinimumLength = 2)] string FullName
);

public record SetPasswordDto(
    [
        Required,
        StringLength(100, MinimumLength = 8),
        RegularExpression(
            ValidationPatterns.Password,
            ErrorMessage = ValidationPatterns.PasswordMessage
        )
    ]
        string NewPassword,
    /// <summary>Required when changing your own password.</summary>
    string? CurrentPassword
);

public record SetActiveDto(bool IsActive);

/// <summary>A category row in the owner's category screen (names in both languages).</summary>
public record AdminCategoryDto(
    int Id,
    string Name,
    string? NameEn,
    string Slug,
    int? ParentId,
    bool IsActive,
    int ProductCount
);

public record UpdateCategoryDto(
    [Required, StringLength(100, MinimumLength = 2)] string Name,
    [StringLength(100)] string? NameEn
);
