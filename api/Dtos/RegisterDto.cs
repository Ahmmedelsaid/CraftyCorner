using System.ComponentModel.DataAnnotations;

namespace CraftyCorner.Api.Dtos;

public record RegisterDto(
    [Required, EmailAddress, StringLength(254)] string Email,
    [
        Required,
        StringLength(100, MinimumLength = 8),
        RegularExpression(
            ValidationPatterns.Password,
            ErrorMessage = ValidationPatterns.PasswordMessage
        )
    ]
        string Password,
    [Required, StringLength(100, MinimumLength = 2)] string FullName,
    [Required, EgyptPhone] string Phone
);

public record UpdateProfileDto(
    [Required, StringLength(100, MinimumLength = 2)] string FullName,
    [Required, EgyptPhone] string Phone,
    [StringLength(300, MinimumLength = 5)] string? Address,
    [StringLength(100, MinimumLength = 2)] string? City
);
