using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CraftyCorner.Api.Data;
using CraftyCorner.Api.Dtos;
using CraftyCorner.Api.Models;

namespace CraftyCorner.Api.Controllers;

/// <summary>The signed-in customer's saved products.</summary>
[ApiController]
[Authorize]
[Route("api/[controller]")]
public class WishlistController(AppDbContext db) : ControllerBase
{
    private int? UserId => int.TryParse(User.FindFirstValue("sub"), out var id) ? id : null;

    [HttpGet]
    public async Task<ActionResult<List<ProductListDto>>> List()
    {
        if (UserId is not { } userId)
            return Unauthorized();

        return await db
            .WishlistItems.AsNoTracking()
            .Where(w => w.UserId == userId && w.Product!.IsActive)
            .OrderByDescending(w => w.CreatedAt)
            .Select(w => new ProductListDto(
                w.Product!.Id,
                w.Product.Name,
                w.Product.Slug,
                w.Product.Price,
                w.Product.ImageUrl,
                w.Product.Brand!.Name,
                w.Product.Category!.Name,
                w.Product.NameEn,
                w.Product.Category.NameEn,
                w.Product.Reviews.Average(r => (double?)r.Rating) ?? 0,
                w.Product.Reviews.Count()
            ))
            .ToListAsync();
    }

    /// <summary>Saves the product (idempotent: saving twice is fine).</summary>
    [HttpPut("{productId:int}")]
    public async Task<IActionResult> Add(int productId)
    {
        if (UserId is not { } userId)
            return Unauthorized();

        if (!await db.Products.AnyAsync(p => p.Id == productId && p.IsActive))
            return NotFound();

        if (!await db.WishlistItems.AnyAsync(w => w.UserId == userId && w.ProductId == productId))
        {
            db.WishlistItems.Add(new WishlistItem { UserId = userId, ProductId = productId });
            try
            {
                await db.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                // two clicks at once: the unique index already has it, which is what we wanted
            }
        }

        return NoContent();
    }

    [HttpDelete("{productId:int}")]
    public async Task<IActionResult> Remove(int productId)
    {
        if (UserId is not { } userId)
            return Unauthorized();

        await db
            .WishlistItems.Where(w => w.UserId == userId && w.ProductId == productId)
            .ExecuteDeleteAsync();
        return NoContent();
    }
}
