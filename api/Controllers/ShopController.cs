using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using CraftyCorner.Api.Services;

namespace CraftyCorner.Api.Controllers;

/// <summary>What the storefront needs to know about the shop's rules (public, nothing secret).</summary>
public record InstaPayDto(string? Handle, string? PhoneNumber, string? AccountName);

public record ShopInfoDto(
    decimal ShippingFee,
    IReadOnlyList<string> DeliveryCities,
    // null while InstaPay is not set up: the checkout then offers cash on delivery only
    InstaPayDto? InstaPay
);

[ApiController]
[Route("api/[controller]")]
public class ShopController(IOptions<ShopOptions> shop) : ControllerBase
{
    [HttpGet]
    public ShopInfoDto Get()
    {
        var instaPay = shop.Value.InstaPay;
        return new(
            shop.Value.ShippingFee,
            shop.Value.DeliveryCities,
            instaPay.IsEnabled ? new InstaPayDto(instaPay.Handle, instaPay.PhoneNumber, instaPay.AccountName) : null
        );
    }
}
