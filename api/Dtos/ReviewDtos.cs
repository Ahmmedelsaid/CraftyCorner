using System.ComponentModel.DataAnnotations;

namespace CraftyCorner.Api.Dtos;

public record ReviewDto(int Id, int Rating, string? Comment, string AuthorName, DateTime CreatedAt, bool IsMine);

public record ReviewSummaryDto(
    double Average,
    int Count,
    // how many reviews gave 1..5 stars, index 0 = one star
    IReadOnlyList<int> Distribution,
    IReadOnlyList<ReviewDto> Items,
    // the signed-in customer may review only after the product was delivered to them
    bool CanReview
);

public record SaveReviewDto(
    [Range(1, 5)] int Rating,
    [StringLength(1000)] string? Comment
);

public record AdminReviewDto(
    int Id,
    int ProductId,
    string ProductName,
    int Rating,
    string? Comment,
    string AuthorName,
    string AuthorEmail,
    DateTime CreatedAt
);

public record UpdateTrackingDto(
    [StringLength(60)] string? Company,
    [StringLength(60)] string? Number
);
