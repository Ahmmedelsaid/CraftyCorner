using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using CraftyCorner.Api.Services;

namespace CraftyCorner.Api.Controllers;

public record ReceiptUploadedDto(string ReceiptId);

/// <summary>Uploading the screenshot of an InstaPay transfer. The receipt is then attached to an order by its id.</summary>
[ApiController]
[Authorize]
[Route("api/[controller]")]
public class PaymentsController(ReceiptStore receipts) : ControllerBase
{
    [HttpPost("receipts")]
    [EnableRateLimiting("receipts")]
    [RequestSizeLimit(ReceiptStore.MaxBytes + 1024 * 64)]
    public async Task<ActionResult<ReceiptUploadedDto>> Upload(IFormFile file, CancellationToken cancellationToken)
    {
        if (!int.TryParse(User.FindFirstValue("sub"), out var userId))
            return Unauthorized();
        if (file is null || file.Length == 0)
            return Problem(detail: "Choose the receipt image first.", statusCode: StatusCodes.Status400BadRequest);
        if (file.Length > ReceiptStore.MaxBytes)
            return Problem(detail: "The image is larger than 5 MB.", statusCode: StatusCodes.Status400BadRequest);

        // not the name, not the type the client claims: the first bytes of the file
        var extension = await ImageSniffer.DetectAsync(file, cancellationToken);
        if (extension is null)
            return Problem(
                detail: "Only JPG, PNG or WebP images are accepted.",
                statusCode: StatusCodes.Status400BadRequest
            );

        return new ReceiptUploadedDto(await receipts.SaveAsync(userId, file, extension, cancellationToken));
    }
}
