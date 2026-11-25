using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CraftyCorner.Api.Data;
using CraftyCorner.Api.Dtos;
using CraftyCorner.Api.Models;

namespace CraftyCorner.Api.Controllers;

/// <summary>
/// Product reviews. Anyone can read them; only a customer who received the product (a Delivered order)
/// can write one, once per product (writing again edits it).
/// </summary>
[ApiController]
[Route("api/products/{productId:int}/reviews")]
public class ReviewsController(AppDbContext db, TimeProvider clock) : ControllerBase
{
    private int? UserId => int.TryParse(User.FindFirstValue("sub"), out var id) ? id : null;

    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<ReviewSummaryDto>> Get(int productId)
    {
        if (!await db.Products.AnyAsync(p => p.Id == productId && p.IsActive))
            return NotFound();

        var userId = UserId;
        var ratings = await db
            .Reviews.AsNoTracking()
            .Where(r => r.ProductId == productId)
            .Select(r => r.Rating)
            .ToListAsync();
        var distribution = Enumerable.Range(1, 5).Select(star => ratings.Count(r => r == star)).ToList();

        var rows = await db
            .Reviews.AsNoTracking()
            .Where(r => r.ProductId == productId)
            .OrderByDescending(r => r.CreatedAt)
            .Take(50)
            .Select(r => new
            {
                r.Id,
                r.Rating,
                r.Comment,
                r.User!.FullName,
                r.CreatedAt,
                r.UserId,
            })
            .ToListAsync();

        var items = rows
            .Select(r => new ReviewDto(
                r.Id,
                r.Rating,
                r.Comment,
                PublicName(r.FullName),
                r.CreatedAt,
                r.UserId == userId
            ))
            .ToList();

        var canReview =
            userId is { } id
            && await db.OrderItems.AnyAsync(i =>
                i.ProductId == productId
                && i.Order!.UserId == id
                && i.Order.Status == OrderStatus.Delivered
            );

        return new ReviewSummaryDto(
            ratings.Count == 0 ? 0 : Math.Round(ratings.Average(), 1),
            ratings.Count,
            distribution,
            items,
            canReview
        );
    }

    /// <summary>Creates the customer's review of the product, or replaces the one they wrote before.</summary>
    [HttpPut]
    [Authorize]
    public async Task<IActionResult> Save(int productId, SaveReviewDto dto)
    {
        if (UserId is not { } userId)
            return Unauthorized();

        if (!await db.Products.AnyAsync(p => p.Id == productId && p.IsActive))
            return NotFound();

        var received = await db.OrderItems.AnyAsync(i =>
            i.ProductId == productId
            && i.Order!.UserId == userId
            && i.Order.Status == OrderStatus.Delivered
        );
        if (!received)
            return Problem(
                detail: "You can review a product after it has been delivered to you.",
                statusCode: StatusCodes.Status403Forbidden
            );

        var comment = string.IsNullOrWhiteSpace(dto.Comment) ? null : dto.Comment.Trim();
        var now = clock.GetUtcNow().UtcDateTime;

        var review = await db.Reviews.FirstOrDefaultAsync(r =>
            r.ProductId == productId && r.UserId == userId
        );
        if (review is null)
        {
            db.Reviews.Add(
                new Review
                {
                    ProductId = productId,
                    UserId = userId,
                    Rating = dto.Rating,
                    Comment = comment,
                    CreatedAt = now,
                    UpdatedAt = now,
                }
            );
        }
        else
        {
            review.Rating = dto.Rating;
            review.Comment = comment;
            review.UpdatedAt = now;
        }

        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete]
    [Authorize]
    public async Task<IActionResult> Delete(int productId)
    {
        if (UserId is not { } userId)
            return Unauthorized();

        await db.Reviews.Where(r => r.ProductId == productId && r.UserId == userId).ExecuteDeleteAsync();
        return NoContent();
    }

    /// <summary>"Ahmed Elsaid" becomes "Ahmed E.": the shop shows a first name only.</summary>
    internal static string PublicName(string fullName)
    {
        var parts = fullName.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return parts.Length switch
        {
            0 => "-",
            1 => parts[0],
            _ => $"{parts[0]} {parts[^1][0]}.",
        };
    }
}
