using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using CraftyCorner.Api.Services;

namespace CraftyCorner.Api.Controllers;

/// <summary>What the storefront needs to know about the shop's rules (public, nothing secret).</summary>
public record ShopInfoDto(decimal ShippingFee, IReadOnlyList<string> DeliveryCities);

[ApiController]
[Route("api/[controller]")]
public class ShopController(IOptions<ShopOptions> shop) : ControllerBase
{
    [HttpGet]
    public ShopInfoDto Get() => new(shop.Value.ShippingFee, shop.Value.DeliveryCities);
}
