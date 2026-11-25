using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CraftyCorner.Api.Data;
using CraftyCorner.Api.Dtos;
using CraftyCorner.Api.Models;

namespace CraftyCorner.Api.Controllers;

/// <summary>
/// The owner accounts: add another admin, edit an admin's name and email, reset a password, and
/// deactivate or reactivate an account. The last active admin can never be locked out.
/// </summary>
[ApiController]
[Authorize(Roles = nameof(UserRole.Admin))]
[Route("api/admin/users")]
public class AdminUsersController(
    AppDbContext db,
    IPasswordHasher<User> hasher,
    TimeProvider clock,
    ILogger<AdminUsersController> logger
) : ControllerBase
{
    private int CurrentUserId => int.TryParse(User.FindFirstValue("sub"), out var id) ? id : 0;

    [HttpGet]
    public async Task<IReadOnlyList<AdminUserDto>> List()
    {
        var me = CurrentUserId;
        return await db
            .Users.AsNoTracking()
            .Where(u => u.Role == UserRole.Admin)
            .OrderBy(u => u.CreatedAt)
            .Select(u => new AdminUserDto(u.Id, u.Email, u.FullName, u.IsActive, u.CreatedAt, u.Id == me))
            .ToListAsync();
    }

    [HttpPost]
    public async Task<ActionResult<AdminUserDto>> Create(CreateAdminDto dto)
    {
        var email = dto.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email == email))
            return Problem(
                detail: "An account with this email already exists.",
                statusCode: StatusCodes.Status409Conflict
            );

        var user = new User
        {
            Email = email,
            FullName = dto.FullName.Trim(),
            PasswordHash = string.Empty,
            Role = UserRole.Admin,
        };
        user.PasswordHash = hasher.HashPassword(user, dto.Password);
        db.Users.Add(user);
        await db.SaveChangesAsync();

        logger.LogInformation("Admin {AdminId} created admin account {NewId}", CurrentUserId, user.Id);
        return StatusCode(StatusCodes.Status201Created, ToDto(user));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<AdminUserDto>> Update(int id, UpdateAdminDto dto)
    {
        var user = await FindAdminAsync(id);
        if (user is null)
            return NotFound();

        var email = dto.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email == email && u.Id != id))
            return Problem(
                detail: "An account with this email already exists.",
                statusCode: StatusCodes.Status409Conflict
            );

        user.Email = email;
        user.FullName = dto.FullName.Trim();
        await db.SaveChangesAsync();
        return ToDto(user);
    }

    /// <summary>
    /// Sets a new password. Changing your own needs the current one; resetting someone else's does not.
    /// Every session of that account is ended, so the new password is needed everywhere.
    /// </summary>
    [HttpPost("{id:int}/password")]
    public async Task<IActionResult> SetPassword(int id, SetPasswordDto dto)
    {
        var user = await FindAdminAsync(id);
        if (user is null)
            return NotFound();

        if (id == CurrentUserId)
        {
            if (
                string.IsNullOrEmpty(dto.CurrentPassword)
                || hasher.VerifyHashedPassword(user, user.PasswordHash, dto.CurrentPassword)
                    == PasswordVerificationResult.Failed
            )
                return Problem(
                    detail: "The current password is not correct.",
                    statusCode: StatusCodes.Status400BadRequest
                );
        }

        user.PasswordHash = hasher.HashPassword(user, dto.NewPassword);
        await db.SaveChangesAsync();
        await RevokeSessionsAsync(user.Id);

        logger.LogInformation("Admin {AdminId} changed the password of admin {TargetId}", CurrentUserId, id);
        return NoContent();
    }

    [HttpPost("{id:int}/active")]
    public async Task<ActionResult<AdminUserDto>> SetActive(int id, SetActiveDto dto)
    {
        var user = await FindAdminAsync(id);
        if (user is null)
            return NotFound();

        if (!dto.IsActive)
        {
            if (id == CurrentUserId)
                return Problem(
                    detail: "You cannot deactivate your own account.",
                    statusCode: StatusCodes.Status409Conflict
                );

            var otherActive = await db.Users.CountAsync(u =>
                u.Role == UserRole.Admin && u.IsActive && u.Id != id
            );
            if (otherActive == 0)
                return Problem(
                    detail: "At least one active admin must remain.",
                    statusCode: StatusCodes.Status409Conflict
                );
        }

        user.IsActive = dto.IsActive;
        await db.SaveChangesAsync();
        if (!dto.IsActive)
            await RevokeSessionsAsync(user.Id);

        return ToDto(user);
    }

    private Task<User?> FindAdminAsync(int id) =>
        db.Users.FirstOrDefaultAsync(u => u.Id == id && u.Role == UserRole.Admin);

    private AdminUserDto ToDto(User u) =>
        new(u.Id, u.Email, u.FullName, u.IsActive, u.CreatedAt, u.Id == CurrentUserId);

    private Task<int> RevokeSessionsAsync(int userId)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        return db
            .RefreshTokens.Where(t => t.UserId == userId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now));
    }
}
