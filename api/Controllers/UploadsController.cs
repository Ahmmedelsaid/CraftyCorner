using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CraftyCorner.Api.Dtos;
using CraftyCorner.Api.Models;

namespace CraftyCorner.Api.Controllers;

/// <summary>
/// Product photo upload for the owner. Files are stored on disk under <see cref="UploadsFolder"/> and served from /uploads.
/// On hosts with a disposable disk (Railway without a volume) the folder must be a mounted volume, or this should be swapped
/// for an image service such as Cloudinary: only this controller has to change.
/// </summary>
[ApiController]
[Authorize(Roles = nameof(UserRole.Admin))]
[Route("api/admin/uploads")]
public class UploadsController(IConfiguration configuration, IWebHostEnvironment environment) : ControllerBase
{
    public const string RequestPath = "/uploads";
    private const long MaxBytes = 5 * 1024 * 1024;

    /// <summary>Where uploads live: Uploads:Path from configuration, otherwise "uploads" next to the app.</summary>
    public static string UploadsFolder(IConfiguration configuration, IWebHostEnvironment environment)
    {
        var configured = configuration["Uploads:Path"];
        return string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(environment.ContentRootPath, "uploads")
            : Path.GetFullPath(configured);
    }

    [HttpPost]
    [RequestSizeLimit(MaxBytes + 1024 * 64)]
    public async Task<ActionResult<UploadResultDto>> Upload(IFormFile file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
            return Problem(detail: "Choose an image first.", statusCode: StatusCodes.Status400BadRequest);
        if (file.Length > MaxBytes)
            return Problem(detail: "The image is larger than 5 MB.", statusCode: StatusCodes.Status400BadRequest);

        // مش بنصدّق اسم الملف ولا الـ content-type اللي العميل بعته: بنقرا أول بايتات الملف ونحدد النوع منها
        var header = new byte[12];
        await using (var peek = file.OpenReadStream())
        {
            var read = await peek.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, cancellationToken);
            if (read < header.Length)
                return NotAnImage();
        }

        var extension = DetectExtension(header);
        if (extension is null)
            return NotAnImage();

        var folder = UploadsFolder(configuration, environment);
        Directory.CreateDirectory(folder);

        // اسم عشوائي من عندنا (مفيش path traversal ولا تعارض أسماء)
        var name = $"{Guid.NewGuid():N}{extension}";
        await using (var target = System.IO.File.Create(Path.Combine(folder, name)))
        {
            await file.CopyToAsync(target, cancellationToken);
        }

        return new UploadResultDto($"{RequestPath}/{name}");
    }

    private ObjectResult NotAnImage() =>
        Problem(detail: "Only JPG, PNG or WebP images are accepted.", statusCode: StatusCodes.Status400BadRequest);

    private static string? DetectExtension(byte[] h)
    {
        if (h[0] == 0xFF && h[1] == 0xD8 && h[2] == 0xFF)
            return ".jpg";
        if (h[0] == 0x89 && h[1] == 0x50 && h[2] == 0x4E && h[3] == 0x47)
            return ".png";
        // WebP: "RIFF" ???? "WEBP"
        if (h[0] == 0x52 && h[1] == 0x49 && h[2] == 0x46 && h[3] == 0x46 && h[8] == 0x57 && h[9] == 0x45 && h[10] == 0x42 && h[11] == 0x50)
            return ".webp";
        return null;
    }
}
