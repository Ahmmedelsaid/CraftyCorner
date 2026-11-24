namespace CraftyCorner.Api.Dtos;

public record AuthResponse(string AccessToken, DateTime ExpiresAtUtc, UserDto User);
