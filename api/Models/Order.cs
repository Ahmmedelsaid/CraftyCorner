namespace CraftyCorner.Api.Models;

public enum OrderStatus
{
    /// <summary>The customer placed the order and it is waiting to be handled (pay on delivery).</summary>
    Placed,
    Cancelled,

    // Owner workflow (stored as text, so adding values needs no migration)
    Confirmed,
    Preparing,
    Shipped,
    Delivered,
}

public enum PaymentMethod
{
    CashOnDelivery,

    /// <summary>The customer sends the money by InstaPay and uploads a screenshot of the transfer.</summary>
    InstaPay,
}

public enum PaymentStatus
{
    /// <summary>Nothing to review (cash on delivery).</summary>
    None,
    AwaitingReview,
    Confirmed,
    Rejected,
}

public class Order
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public User? User { get; set; }

    public OrderStatus Status { get; set; } = OrderStatus.Placed;

    // بيانات التوصيل بتتخزن مع الطلب (مش مربوطة بالـ User) عشان تفضل زي ما كانت وقت الطلب
    public required string ShippingName { get; set; }
    public required string Phone { get; set; }
    public required string Address { get; set; }
    public required string City { get; set; }
    public string? Notes { get; set; }

    /// <summary>Optional pin the customer dropped on the map. Both are set or both are null.</summary>
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    /// <summary>Delivery fee charged on this order (copied from the shop setting when it was placed).</summary>
    public decimal ShippingFee { get; set; }

    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.CashOnDelivery;
    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.None;

    /// <summary>Id of the uploaded transfer screenshot (kept privately, see ReceiptStore).</summary>
    public string? PaymentReceipt { get; set; }

    /// <summary>The InstaPay reference number the customer typed (optional).</summary>
    public string? PaymentReference { get; set; }

    /// <summary>Why the owner rejected the payment, shown to the customer.</summary>
    public string? PaymentNote { get; set; }

    public DateTime? PaymentReviewedAt { get; set; }

    /// <summary>What the customer pays: the items plus the shipping fee.</summary>
    public decimal Total { get; set; }

    /// <summary>Courier name and tracking number, entered by the owner when the order is handed over.</summary>
    public string? TrackingCompany { get; set; }
    public string? TrackingNumber { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CancelledAt { get; set; }

    public List<OrderItem> Items { get; set; } = [];
}

/// <summary>A product line of an order. Name and price are copied, so later catalog edits do not change old orders.</summary>
public class OrderItem
{
    public int Id { get; set; }

    public int OrderId { get; set; }
    public Order? Order { get; set; }

    public int ProductId { get; set; }
    public Product? Product { get; set; }

    public required string ProductName { get; set; }
    public string? ImageUrl { get; set; }
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
}
