using System.Net;
using System.Net.Http.Json;
using System.Text;
using CraftyCorner.Api.Models;

namespace CraftyCorner.Api.Tests;

public class UploadTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly byte[] PngHeader = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0, 0, 0, 0, 0];
    private static readonly byte[] JpegHeader = [0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    private static MultipartFormDataContent Upload(byte[] bytes, string fileName, string contentType = "image/png")
    {
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new("image/png");
        file.Headers.ContentType = new(contentType);
        return new MultipartFormDataContent { { file, "file", fileName } };
    }

    private async Task<HttpClient> Admin() => await factory.ClientFor(factory.AddUser(UserRole.Admin));

    private sealed record UploadResult(string Url);

    [Fact]
    public async Task An_admin_can_upload_a_real_image_and_it_is_served_with_nosniff()
    {
        var admin = await Admin();

        var response = await admin.PostAsync("/api/admin/uploads", Upload(PngHeader, "photo.png"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = (await response.Content.ReadFromJsonAsync<UploadResult>())!;
        Assert.StartsWith("/uploads/", result.Url);
        Assert.EndsWith(".png", result.Url);

        var served = await factory.CreateClient().GetAsync(result.Url);
        Assert.Equal(HttpStatusCode.OK, served.StatusCode);
        Assert.Equal("nosniff", served.Headers.GetValues("X-Content-Type-Options").Single());
    }

    [Fact]
    public async Task The_stored_name_is_random_and_ignores_the_name_the_client_sent()
    {
        var admin = await Admin();

        var response = await admin.PostAsync("/api/admin/uploads", Upload(JpegHeader, "../../evil name.php.jpg", "image/jpeg"));

        var result = (await response.Content.ReadFromJsonAsync<UploadResult>())!;
        Assert.EndsWith(".jpg", result.Url);
        Assert.DoesNotContain("evil", result.Url);
        Assert.DoesNotContain("..", result.Url);
    }

    [Fact]
    public async Task A_script_renamed_to_png_is_rejected_because_the_content_is_checked()
    {
        var admin = await Admin();
        var script = Encoding.UTF8.GetBytes("<script>alert(1)</script> padding padding");

        var response = await admin.PostAsync("/api/admin/uploads", Upload(script, "photo.png"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task An_svg_is_rejected_even_with_an_image_content_type()
    {
        var admin = await Admin();
        var svg = Encoding.UTF8.GetBytes("<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>");

        var response = await admin.PostAsync("/api/admin/uploads", Upload(svg, "logo.svg", "image/svg+xml"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task A_file_over_five_megabytes_is_rejected()
    {
        var admin = await Admin();
        var big = new byte[5 * 1024 * 1024 + 100];
        PngHeader.CopyTo(big, 0);

        var response = await admin.PostAsync("/api/admin/uploads", Upload(big, "big.png"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task A_customer_cannot_upload()
    {
        var customer = await factory.ClientFor(factory.AddUser());

        var response = await customer.PostAsync("/api/admin/uploads", Upload(PngHeader, "photo.png"));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
