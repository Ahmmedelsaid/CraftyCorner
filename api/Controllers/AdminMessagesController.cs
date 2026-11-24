using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CraftyCorner.Api.Data;
using CraftyCorner.Api.Dtos;
using CraftyCorner.Api.Models;

namespace CraftyCorner.Api.Controllers;

/// <summary>Messages customers sent from the Contact page.</summary>
[ApiController]
[Authorize(Roles = nameof(UserRole.Admin))]
[Route("api/admin/messages")]
public class AdminMessagesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<AdminMessageDto>>> List(
        bool? unread,
        int page = 1,
        int pageSize = 20
    )
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.ContactMessages.AsNoTracking();
        if (unread == true)
            query = query.Where(m => !m.IsRead);

        var total = await query.CountAsync();
        var rows = await query
            .OrderByDescending(m => m.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<AdminMessageDto>([.. rows.Select(AdminMessageDto.From)], total, page, pageSize);
    }

    [HttpPost("{id:int}/read")]
    public async Task<IActionResult> MarkRead(int id, bool isRead = true)
    {
        var updated = await db
            .ContactMessages.Where(m => m.Id == id)
            .ExecuteUpdateAsync(set => set.SetProperty(m => m.IsRead, isRead));
        return updated == 0 ? NotFound() : NoContent();
    }
}
