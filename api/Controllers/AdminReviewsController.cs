using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CraftyCorner.Api.Data;
using CraftyCorner.Api.Dtos;
using CraftyCorner.Api.Models;

namespace CraftyCorner.Api.Controllers;

/// <summary>Lets the owner read every review and remove inappropriate ones.</summary>
[ApiController]
[Authorize(Roles = nameof(UserRole.Admin))]
[Route("api/admin/reviews")]
public class AdminReviewsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<AdminReviewDto>>> List(int page = 1, int pageSize = 20)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var total = await db.Reviews.CountAsync();
        var items = await db
            .Reviews.AsNoTracking()
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new AdminReviewDto(
                r.Id,
                r.ProductId,
                r.Product!.Name,
                r.Rating,
                r.Comment,
                r.User!.FullName,
                r.User.Email,
                r.CreatedAt
            ))
            .ToListAsync();

        return new PagedResult<AdminReviewDto>(items, total, page, pageSize);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await db.Reviews.Where(r => r.Id == id).ExecuteDeleteAsync();
        return deleted == 0 ? NotFound() : NoContent();
    }
}
