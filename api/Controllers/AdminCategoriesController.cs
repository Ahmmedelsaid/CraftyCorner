using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CraftyCorner.Api.Data;
using CraftyCorner.Api.Dtos;
using CraftyCorner.Api.Models;

namespace CraftyCorner.Api.Controllers;

/// <summary>Lets the owner rename categories (Arabic and English names).</summary>
[ApiController]
[Authorize(Roles = nameof(UserRole.Admin))]
[Route("api/admin/categories")]
public class AdminCategoriesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<List<AdminCategoryDto>> List() =>
        await db
            .Categories.AsNoTracking()
            .OrderBy(c => c.ParentId == null ? 0 : 1)
            .ThenBy(c => c.Name)
            .Select(c => new AdminCategoryDto(
                c.Id,
                c.Name,
                c.NameEn,
                c.Slug,
                c.ParentId,
                c.IsActive,
                c.Products.Count
            ))
            .ToListAsync();

    [HttpPut("{id:int}")]
    public async Task<ActionResult<AdminCategoryDto>> Update(int id, UpdateCategoryDto dto)
    {
        var category = await db.Categories.FindAsync(id);
        if (category is null)
            return NotFound();

        category.Name = dto.Name.Trim();
        category.NameEn = string.IsNullOrWhiteSpace(dto.NameEn) ? null : dto.NameEn.Trim();
        category.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var count = await db.Products.CountAsync(p => p.CategoryId == id);
        return new AdminCategoryDto(
            category.Id,
            category.Name,
            category.NameEn,
            category.Slug,
            category.ParentId,
            category.IsActive,
            count
        );
    }
}
