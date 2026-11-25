namespace CraftyCorner.Api.Services;

/// <summary>Shop-wide settings (section "Shop").</summary>
public class ShopOptions
{
    public const string SectionName = "Shop";

    /// <summary>
    /// Delivery fee added to every order, in EGP, until the shop decides on real delivery pricing.
    /// Change it with Shop:ShippingFee (appsettings or an environment variable Shop__ShippingFee). The fee is
    /// copied onto each order when it is placed, so changing it later never changes old orders.
    /// </summary>
    public decimal ShippingFee { get; set; } = 100;

    /// <summary>
    /// The governorates the shop delivers to (the values the checkout sends: Cairo, Giza, Qalyubia...).
    /// Orders for any other city are refused. Change it with Shop:DeliveryCities.
    /// </summary>
    public List<string> DeliveryCities { get; set; } = ["Cairo", "Giza", "Qalyubia"];
}
