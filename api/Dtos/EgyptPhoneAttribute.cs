using System.ComponentModel.DataAnnotations;

namespace CraftyCorner.Api.Dtos;

/// <summary>
/// Egyptian mobile numbers only (010, 011, 012, 015). The customer can type 01011252834, +20 101 125 2834 or
/// 0020 1011252834; <see cref="Normalize"/> turns all of them into the local form 01011252834 for storage.
/// </summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter)]
public sealed class EgyptPhoneAttribute : ValidationAttribute
{
    public EgyptPhoneAttribute()
        : base("Enter an Egyptian mobile number, like 01012345678.") { }

    public override bool IsValid(object? value) =>
        value is null or "" || (value is string text && Normalize(text) is not null);

    /// <summary>The number in local form (01XXXXXXXXX), or null when it is not an Egyptian mobile number.</summary>
    public static string? Normalize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return null;

        var digits = new string(input.Where(char.IsAsciiDigit).ToArray());
        if (digits.StartsWith("0020"))
            digits = digits[4..];
        else if (digits.StartsWith("20") && digits.Length == 12)
            digits = digits[2..];

        if (digits.Length == 10 && digits[0] == '1')
            digits = "0" + digits;

        return System.Text.RegularExpressions.Regex.IsMatch(digits, "^01[0125][0-9]{8}$") ? digits : null;
    }
}
