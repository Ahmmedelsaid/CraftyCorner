namespace CraftyCorner.Api.Data;

/// <summary>One row of the sample catalogue, before it becomes a <c>Product</c>.</summary>
internal sealed record SeedProduct(
    string CategorySlug,
    string Brand,
    string Name,
    decimal Price,
    int Stock,
    string? ImageUrl,
    string Sku,
    string Slug,
    string Description,
    Dictionary<string, string> Specs,
    bool IsActive
);

/// <summary>
/// SAMPLE catalogue so the site is not empty on a fresh database. Names, prices and stock are placeholders:
/// the owner replaces them from the dashboard. Names are Arabic, so every row carries an explicit English slug.
/// </summary>
internal static class SeedCatalog
{
    public const string BrandName = "Crafty Corner";

    public static readonly (string Name, string Slug)[] Categories =
    [
        ("رمضان والمباخر", "ramadan"),
        ("صواني وفازات", "trays-vases"),
        ("تماثيل وإضاءة", "figurines-lights"),
        ("تنظيم وهدايا", "organizers-gifts"),
    ];

    public static List<SeedProduct> Products() =>
        [
            Row("ramadan", "crescent-incense-tray", "طقم هلال ومبخرة", 520, 6, "crescent-white", "جبس أبيض بنقش هلال مع صينية مموّجة وسبحة خشب. مثالي لزينة رمضان.", "الخامة=جبس;اللون=أبيض"),
            Row("ramadan", "mosque-candle-set", "فانوس المسجد وحامل الشمع", 420, 8, "mosque-candle", "فانوس بشكل مسجد مع حامل شمع على طبق متموّج.", "الخامة=جبس;اللون=أبيض"),
            Row("ramadan", "ramadan-incense-tray", "صينية رمضان بالمبخرة", 560, 5, "ramadan-tray", "صينية مع مبخرة ذهبية وهلال منقوش وسبحة.", "الخامة=جبس وخزف;اللون=أبيض وذهبي"),
            Row("trays-vases", "stacked-vase", "فازة متراصّة مع طبق", 380, 7, "vase-stack", "فازة بأشكال عضوية متراصّة على طبق خزف متموّج.", "الخامة=خزف;اللون=كريمي"),
            Row("trays-vases", "sheep-trinket-dish", "طبق إكسسوارات بالخروف", 240, 12, "sheep", "طبق صغير للإكسسوارات بتفصيلة خروف مصنوعة يدوياً.", "الخامة=خزف;اللون=كريمي"),
            Row("figurines-lights", "couple-busts-incense", "تمثال العروسين مع المبخرة", 480, 4, "busts", "تمثالان بدون وجه بلونين مع مبخرة ذهبية على سجادة خوص.", "الخامة=جبس ملوّن;اللون=بيج وبني"),
            Row("figurines-lights", "glow-house-couple", "بيت منوّر مع تمثال", 450, 5, "candle-house", "بيت بنافذة مضيئة بالشمعة مع تمثال زوجين.", "الخامة=جبس;اللون=كريمي"),
            Row("figurines-lights", "home-red-heart", "بيت HOME بقلب أحمر", 390, 9, "house", "بيت بكلمة HOME وقلب أحمر على طبق خزف.", "الخامة=جبس;اللون=كريمي وأحمر"),
            Row("organizers-gifts", "brush-holders-bows", "ستاند فرش المكياج بالفيونكات", 350, 10, "brush-bows", "كوبان مضلّعان بفيونكات حمراء على صينية صغيرة.", "الخامة=جبس;اللون=كريمي وأحمر"),
            Row("organizers-gifts", "nail-polish-shelf", "رف الأظافر بالفيونكات", 430, 5, "shelf-bows", "رف بشكل قوس لتنظيم طلاء الأظافر مع ستاند فرش.", "الخامة=جبس;اللون=كريمي"),
            Row("organizers-gifts", "black-gold-set", "طقم أسود بتفاصيل ذهبية", 610, 3, "black-set", "طقم ديكور أسود بلمسات ذهبية للمداخل والرفوف.", "الخامة=جبس;اللون=أسود وذهبي"),
        ];

    private static SeedProduct Row(
        string category,
        string slug,
        string name,
        decimal price,
        int stock,
        string image,
        string description,
        string specs
    ) =>
        new(
            CategorySlug: category,
            Brand: BrandName,
            Name: name,
            Price: price,
            Stock: stock,
            ImageUrl: $"/images/products/sample/{image}.jpg",
            Sku: "CC-" + slug.ToUpperInvariant(),
            Slug: slug,
            Description: description,
            Specs: specs
                .Split(';', StringSplitOptions.RemoveEmptyEntries)
                .Select(pair => pair.Split('=', 2))
                .ToDictionary(pair => pair[0], pair => pair[1]),
            IsActive: true
        );

    public static string Slugify(string text)
    {
        var chars = text.ToLowerInvariant()
            .Select(ch => char.IsAsciiLetterOrDigit(ch) ? ch : '-')
            .ToArray();
        return string.Join(
            '-',
            new string(chars).Split('-', StringSplitOptions.RemoveEmptyEntries)
        );
    }
}
