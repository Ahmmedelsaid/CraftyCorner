using CraftyCorner.Api.Models;

namespace CraftyCorner.Api.Dtos;

public record UserDto(
    int Id,
    string Email,
    string FullName,
    string Role,
    string? Phone,
    string? Address,
    string? City
)
{
    public static UserDto From(User user) =>
        new(
            user.Id,
            user.Email,
            user.FullName,
            user.Role.ToString(),
            user.Phone,
            user.Address,
            user.City
        );
}
