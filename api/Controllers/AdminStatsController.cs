using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CraftyCorner.Api.Data;
using CraftyCorner.Api.Dtos;
using CraftyCorner.Api.Models;

namespace CraftyCorner.Api.Controllers;

/// <summary>The numbers on the owner's dashboard home.</summary>
[ApiController]
[Authorize(Roles = nameof(UserRole.Admin))]
[Route("api/admin/stats")]
public class AdminStatsController(AppDbContext db, TimeProvider clock) : ControllerBase
{
    private const int LowStockThreshold = 3;

    [HttpGet]
    public async Task<AdminStatsDto> Get()
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var today = now.Date;
        var weekStart = today.AddDays(-6);

        var counts = await db
            .Orders.GroupBy(o => o.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();
        var byStatus = Enum.GetValues<OrderStatus>()
            .ToDictionary(s => s.ToString(), s => counts.FirstOrDefault(c => c.Status == s)?.Count ?? 0);

        var ordersToday = await db.Orders.CountAsync(o => o.CreatedAt >= today);

        var delivered = await db
            .Orders.Where(o => o.Status == OrderStatus.Delivered)
            .SumAsync(o => (decimal?)o.Total) ?? 0m;

        // طلبات لسه شغالة (مش اتلغت ولا اتسلمت): قيمة الفلوس اللي منتظراها
        var open = await db
            .Orders.Where(o => o.Status != OrderStatus.Delivered && o.Status != OrderStatus.Cancelled)
            .SumAsync(o => (decimal?)o.Total) ?? 0m;

        var activeProducts = await db.Products.CountAsync(p => p.IsActive);
        var unread = await db.ContactMessages.CountAsync(m => !m.IsRead);

        var lowStock = await db
            .Products.Where(p => p.IsActive && p.StockQuantity <= LowStockThreshold)
            .OrderBy(p => p.StockQuantity)
            .ThenBy(p => p.Name)
            .Take(6)
            .Select(p => new LowStockDto(p.Id, p.Name, p.StockQuantity, p.ImageUrl))
            .ToListAsync();

        var perDay = await db
            .Orders.Where(o => o.CreatedAt >= weekStart && o.Status != OrderStatus.Cancelled)
            .GroupBy(o => o.CreatedAt.Date)
            .Select(g => new { Day = g.Key, Count = g.Count() })
            .ToListAsync();
        var last7 = Enumerable
            .Range(0, 7)
            .Select(i => weekStart.AddDays(i))
            .Select(d => new DailyOrdersDto(
                DateOnly.FromDateTime(d),
                perDay.FirstOrDefault(x => x.Day == d)?.Count ?? 0
            ))
            .ToList();

        return new AdminStatsDto(byStatus, ordersToday, delivered, open, activeProducts, unread, lowStock, last7);
    }
}
