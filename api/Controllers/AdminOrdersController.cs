using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CraftyCorner.Api.Data;
using CraftyCorner.Api.Dtos;
using CraftyCorner.Api.Models;

namespace CraftyCorner.Api.Controllers;

/// <summary>The owner's view of every order, and the workflow New, Confirmed, Preparing, Shipped, Delivered (or Cancelled).</summary>
[ApiController]
[Authorize(Roles = nameof(UserRole.Admin))]
[Route("api/admin/orders")]
public class AdminOrdersController(AppDbContext db, TimeProvider clock) : ControllerBase
{
    /// <summary>Which statuses an order may move to from each status. Delivered and Cancelled are final.</summary>
    private static readonly Dictionary<OrderStatus, OrderStatus[]> Transitions = new()
    {
        [OrderStatus.Placed] = [OrderStatus.Confirmed, OrderStatus.Cancelled],
        [OrderStatus.Confirmed] = [OrderStatus.Preparing, OrderStatus.Cancelled],
        [OrderStatus.Preparing] = [OrderStatus.Shipped, OrderStatus.Cancelled],
        [OrderStatus.Shipped] = [OrderStatus.Delivered, OrderStatus.Cancelled],
    };

    [HttpGet]
    public async Task<ActionResult<PagedResult<AdminOrderListDto>>> List(
        string? status,
        string? search,
        DateTimeOffset? from,
        DateTimeOffset? to,
        int page = 1,
        int pageSize = 20
    )
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.Orders.AsNoTracking();

        // from (شامل) و to (غير شامل): لحظات UTC، والموقع بيبعت بداية اليوم بتوقيت المستخدم
        if (from is { } fromDate)
        {
            var start = fromDate.UtcDateTime;
            query = query.Where(o => o.CreatedAt >= start);
        }
        if (to is { } toDate)
        {
            var end = toDate.UtcDateTime;
            query = query.Where(o => o.CreatedAt < end);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<OrderStatus>(status, ignoreCase: true, out var parsed))
                return Problem(detail: "Unknown status.", statusCode: StatusCodes.Status400BadRequest);
            query = query.Where(o => o.Status == parsed);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = int.TryParse(term, out var id)
                ? query.Where(o => o.Id == id || o.Phone.Contains(term))
                : query.Where(o => o.ShippingName.Contains(term) || o.Phone.Contains(term));
        }

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(o => new AdminOrderListDto(
                o.Id,
                o.Status.ToString(),
                o.Total,
                o.Items.Sum(i => i.Quantity),
                o.CreatedAt,
                o.ShippingName,
                o.Phone,
                o.City
            ))
            .ToListAsync();

        return new PagedResult<AdminOrderListDto>(items, total, page, pageSize);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<OrderDto>> Get(int id)
    {
        var order = await db.Orders.AsNoTracking().Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id);
        return order is null ? NotFound() : OrderDto.From(order);
    }

    [HttpPost("{id:int}/status")]
    public async Task<ActionResult<OrderDto>> SetStatus(int id, UpdateOrderStatusDto dto)
    {
        if (!Enum.TryParse<OrderStatus>(dto.Status, ignoreCase: true, out var next))
            return Problem(detail: "Unknown status.", statusCode: StatusCodes.Status400BadRequest);

        var order = await db.Orders.AsNoTracking().Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id);
        if (order is null)
            return NotFound();

        var current = order.Status;
        if (!Transitions.TryGetValue(current, out var allowed) || !allowed.Contains(next))
            return Problem(
                detail: $"An order that is {current} cannot become {next}.",
                statusCode: StatusCodes.Status409Conflict
            );

        var now = clock.GetUtcNow().UtcDateTime;
        await using var transaction = await db.Database.BeginTransactionAsync();

        // شرطي على الحالة الحالية: لو اتبعت طلبين في نفس اللحظة، واحد بس ينجح (والمخزون يرجع مرة واحدة بس)
        var changed = await db
            .Orders.Where(o => o.Id == id && o.Status == current)
            .ExecuteUpdateAsync(set =>
                set.SetProperty(o => o.Status, next)
                    .SetProperty(o => o.CancelledAt, o => next == OrderStatus.Cancelled ? now : o.CancelledAt)
            );
        if (changed == 0)
        {
            await transaction.RollbackAsync();
            return Problem(
                detail: "The order was changed by someone else. Reload and try again.",
                statusCode: StatusCodes.Status409Conflict
            );
        }

        if (next == OrderStatus.Cancelled)
        {
            foreach (var item in order.Items)
            {
                var quantity = item.Quantity;
                await db
                    .Products.Where(p => p.Id == item.ProductId)
                    .ExecuteUpdateAsync(set =>
                        set.SetProperty(p => p.StockQuantity, p => p.StockQuantity + quantity)
                            .SetProperty(p => p.UpdatedAt, now)
                    );
            }
        }

        await transaction.CommitAsync();

        order.Status = next;
        if (next == OrderStatus.Cancelled)
            order.CancelledAt = now;
        return OrderDto.From(order);
    }
}
