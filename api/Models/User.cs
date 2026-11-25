namespace CraftyCorner.Api.Models;

public class User
{
    public int Id { get; set; }

    /// <summary>Always stored trimmed and lowercase, so the unique index is case-insensitive.</summary>
    public required string Email { get; set; }

    /// <summary>PBKDF2 hash produced by PasswordHasher. The plain password is never stored.</summary>
    public required string PasswordHash { get; set; }

    public required string FullName { get; set; }

    public UserRole Role { get; set; } = UserRole.Customer;

    /// <summary>Egyptian mobile in local form (01XXXXXXXXX). The shop calls the customer on it to confirm orders.</summary>
    public string? Phone { get; set; }

    /// <summary>The customer's default delivery address, pre-filled at checkout.</summary>
    public string? Address { get; set; }

    public string? City { get; set; }

    public bool IsActive { get; set; } = true;

    /// <summary>Consecutive wrong passwords. After a few, the account is locked for a while (see AuthController).</summary>
    public int FailedLoginCount { get; set; }

    public DateTime? LockedUntil { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
