namespace CraftyCorner.Api.Models;

/// <summary>A product a customer saved to come back to. One row per customer per product.</summary>
public class WishlistItem
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public User? User { get; set; }

    public int ProductId { get; set; }
    public Product? Product { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
