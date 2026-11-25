using System.Text.RegularExpressions;

namespace CraftyCorner.Api.Services;

/// <summary>
/// Recognises JPG, PNG and WebP by the first bytes of a file (never by its name or the type the client claims).
/// Shared by the product photo upload and the payment receipt upload.
/// </summary>
public static class ImageSniffer
{
    public static string? Extension(ReadOnlySpan<byte> h)
    {
        if (h.Length < 12)
            return null;
        if (h[0] == 0xFF && h[1] == 0xD8 && h[2] == 0xFF)
            return ".jpg";
        if (h[0] == 0x89 && h[1] == 0x50 && h[2] == 0x4E && h[3] == 0x47)
            return ".png";
        // WebP: "RIFF" ???? "WEBP"
        if (h[0] == 0x52 && h[1] == 0x49 && h[2] == 0x46 && h[3] == 0x46 && h[8] == 0x57 && h[9] == 0x45 && h[10] == 0x42 && h[11] == 0x50)
            return ".webp";
        return null;
    }

    public static async Task<string?> DetectAsync(IFormFile file, CancellationToken cancellationToken)
    {
        var header = new byte[12];
        await using var stream = file.OpenReadStream();
        var read = await stream.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, cancellationToken);
        return read < header.Length ? null : Extension(header);
    }
}

/// <summary>
/// Where payment receipts (screenshots of a bank transfer) are kept. They are private: a receipt is never served
/// as a static file, only through endpoints that check who is asking. Files live in one folder per customer, so a
/// customer can only attach a receipt they uploaded themselves.
/// </summary>
public sealed partial class ReceiptStore(IConfiguration configuration, IWebHostEnvironment environment)
{
    public const long MaxBytes = 5 * 1024 * 1024;

    [GeneratedRegex(@"^[0-9a-f]{32}\.(jpg|png|webp)$")]
    private static partial Regex IdPattern();

    private string Root =>
        string.IsNullOrWhiteSpace(configuration["Receipts:Path"])
            ? Path.Combine(environment.ContentRootPath, "receipts")
            : Path.GetFullPath(configuration["Receipts:Path"]!);

    /// <summary>The id the client got back from the upload: 32 hex characters and the extension, nothing else.</summary>
    public static bool IsValidId(string? id) => id is not null && IdPattern().IsMatch(id);

    /// <summary>Stores the (already checked) image for the customer and returns its id.</summary>
    public async Task<string> SaveAsync(int userId, IFormFile file, string extension, CancellationToken cancellationToken)
    {
        var folder = Path.Combine(Root, userId.ToString());
        Directory.CreateDirectory(folder);

        var id = $"{Guid.NewGuid():N}{extension}";
        await using var target = File.Create(Path.Combine(folder, id));
        await file.CopyToAsync(target, cancellationToken);
        return id;
    }

    /// <summary>The path of the customer's receipt, or null when the id is malformed or there is no such file.</summary>
    public string? PathFor(int userId, string? id)
    {
        if (!IsValidId(id))
            return null;
        var path = Path.Combine(Root, userId.ToString(), id!);
        return File.Exists(path) ? path : null;
    }

    public static string ContentType(string id) =>
        Path.GetExtension(id) switch
        {
            ".png" => "image/png",
            ".webp" => "image/webp",
            _ => "image/jpeg",
        };
}
