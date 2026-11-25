using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CraftyCorner.Api.Data;
using CraftyCorner.Api.Dtos;
using CraftyCorner.Api.Models;

namespace CraftyCorner.Api.Controllers;

/// <summary>
/// Read side of the owner's product screen: it also shows hidden products, which the public catalogue never returns.
/// Creating, editing and hiding products uses <see cref="ProductsController"/> (PUT / POST / DELETE).
/// </summary>
[ApiController]
[Authorize(Roles = nameof(UserRole.Admin))]
[Route("api/admin/products")]
public class AdminProductsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<AdminProductListDto>>> List(
        string? search,
        bool? active,
        int? categoryId,
        string? stock,
        string? sort,
        int page = 1,
        int pageSize = 20
    )
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.Products.AsNoTracking();
        if (active is { } isActive)
            query = query.Where(p => p.IsActive == isActive);
        if (categoryId is { } category)
            query = query.Where(p => p.CategoryId == category);
        // نفس حد "قربت تخلص" في الصفحة الرئيسية (3 قطع أو أقل)
        query = stock switch
        {
            "out" => query.Where(p => p.StockQuantity == 0),
            "low" => query.Where(p => p.StockQuantity > 0 && p.StockQuantity <= 3),
            "ok" => query.Where(p => p.StockQuantity > 3),
            _ => query,
        };
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(p => p.Name.Contains(term) || p.Sku.Contains(term));
        }

        query = sort switch
        {
            "name" => query.OrderBy(p => p.Name),
            "price_asc" => query.OrderBy(p => p.Price),
            "price_desc" => query.OrderByDescending(p => p.Price),
            "stock_asc" => query.OrderBy(p => p.StockQuantity),
            _ => query.OrderByDescending(p => p.CreatedAt),
        };

        var total = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new AdminProductListDto(
                p.Id,
                p.Name,
                p.Sku,
                p.Price,
                p.StockQuantity,
                p.IsActive,
                p.ImageUrl,
                p.Category!.Name,
                p.CategoryId
            ))
            .ToListAsync();

        return new PagedResult<AdminProductListDto>(items, total, page, pageSize);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ProductDetailsDto>> Get(int id)
    {
        var product = await db
            .Products.AsNoTracking()
            .Where(p => p.Id == id)
            .Select(p => new ProductDetailsDto(
                p.Id,
                p.Name,
                p.Slug,
                p.Sku,
                p.Description,
                p.ImageUrl,
                p.Price,
                p.StockQuantity,
                p.IsActive,
                p.Specs,
                p.Category!.Name,
                p.Brand!.Name,
                p.CreatedAt,
                p.UpdatedAt,
                p.CategoryId,
                p.BrandId
            ))
            .FirstOrDefaultAsync();

        return product is null ? NotFound() : product;
    }
}
