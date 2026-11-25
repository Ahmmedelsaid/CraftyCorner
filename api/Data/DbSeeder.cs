using Microsoft.EntityFrameworkCore;
using CraftyCorner.Api.Models;

namespace CraftyCorner.Api.Data;

public static class DbSeeder
{
    /// <summary>
    /// Fills the demo catalogue (see <see cref="SeedCatalog"/>). It only ADDS what is missing (matched by slug
    /// and SKU) and never touches existing rows, so it is safe to run on every start of a development database.
    /// </summary>
    /// <returns>How many products were added.</returns>
    public static async Task<int> SeedAsync(AppDbContext db)
    {
        var rows = SeedCatalog.Products();

        var root = await GetOrAddCategoryAsync(
            db,
            "ديكور",
            "home-decor",
            parent: null
        );
        root.NameEn ??= "Home Decor";
        var categories = new Dictionary<string, Category>();
        foreach (var (name, slug, nameEn) in SeedCatalog.Categories)
        {
            var category = await GetOrAddCategoryAsync(db, name, slug, root);
            // fill the English name on rows created before it existed, but never overwrite the owner's edits
            category.NameEn ??= nameEn;
            categories[slug] = category;
        }

        var brands = await db.Brands.ToDictionaryAsync(b => b.Slug);
        foreach (var name in rows.Select(r => r.Brand).Distinct())
        {
            var slug = SeedCatalog.Slugify(name);
            if (brands.ContainsKey(slug))
                continue;

            var brand = new Brand
            {
                Name = name,
                Slug = slug,
                IsActive = true,
            };
            db.Brands.Add(brand);
            brands[slug] = brand;
        }

        var knownSlugs = (await db.Products.Select(p => p.Slug).ToListAsync()).ToHashSet();
        var knownSkus = (await db.Products.Select(p => p.Sku).ToListAsync()).ToHashSet();

        // ترتيب ثابت بس مخلوط بين الأقسام، عشان "وصل حديثاً" ما يطلعش قسم واحد بس
        var now = DateTime.UtcNow;
        var added = 0;
        foreach (var row in rows.OrderBy(r => StableHash(r.Slug)))
        {
            // slug و SKU الاتنين unique: اللي موجود (حتى لو اتعدّل) ما نلمسوش
            if (!knownSlugs.Add(row.Slug) || !knownSkus.Add(row.Sku))
            {
                var existing = await db.Products.FirstOrDefaultAsync(p => p.Slug == row.Slug);
                if (existing is not null)
                {
                    existing.NameEn ??= row.NameEn;
                    existing.DescriptionEn ??= row.DescriptionEn;
                }
                continue;
            }

            db.Products.Add(
                new Product
                {
                    Name = row.Name,
                    Slug = row.Slug,
                    Sku = row.Sku,
                    Description = row.Description,
                    NameEn = row.NameEn,
                    DescriptionEn = row.DescriptionEn,
                    ImageUrl = row.ImageUrl,
                    Price = row.Price,
                    StockQuantity = row.Stock,
                    IsActive = row.IsActive,
                    Category = categories[row.CategorySlug],
                    Brand = brands[SeedCatalog.Slugify(row.Brand)],
                    Specs = row.Specs,
                    CreatedAt = now.AddMinutes(-added),
                    UpdatedAt = now.AddMinutes(-added),
                }
            );
            added++;
        }

        await db.SaveChangesAsync();
        return added;
    }

    /// <summary>FNV-1a: same value on every run (string.GetHashCode is randomised per process).</summary>
    private static uint StableHash(string text)
    {
        var hash = 2166136261u;
        foreach (var b in System.Text.Encoding.UTF8.GetBytes(text))
            hash = (hash ^ b) * 16777619u;
        return hash;
    }

    private static async Task<Category> GetOrAddCategoryAsync(
        AppDbContext db,
        string name,
        string slug,
        Category? parent
    )
    {
        var existing = await db.Categories.FirstOrDefaultAsync(c => c.Slug == slug);
        if (existing is not null)
            return existing;

        var category = new Category
        {
            Name = name,
            Slug = slug,
            Parent = parent,
            IsActive = true,
        };
        db.Categories.Add(category);
        return category;
    }
}
