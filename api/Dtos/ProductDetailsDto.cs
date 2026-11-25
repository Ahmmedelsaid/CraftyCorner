namespace CraftyCorner.Api.Dtos;

public record ProductDetailsDto(
    int Id,
    string Name,
    string Slug,
    string Sku,
    string? Description,
    string? ImageUrl,
    decimal Price,
    int StockQuantity,
    bool IsActive,
    Dictionary<string, string> Specs,
    string CategoryName,
    string BrandName,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    int CategoryId = 0,
    int BrandId = 0,
    string? NameEn = null,
    string? DescriptionEn = null,
    string? CategoryNameEn = null,
    double RatingAverage = 0,
    int RatingCount = 0
);
