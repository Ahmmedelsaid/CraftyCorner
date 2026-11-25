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

    /// <summary>Pay by InstaPay (Shop:InstaPay). Off until the shop's InstaPay address or phone is set.</summary>
    public InstaPayOptions InstaPay { get; set; } = new();
}

public class InstaPayOptions
{
    /// <summary>The shop's InstaPay address, for example craftycorner@instapay.</summary>
    public string? Handle { get; set; }

    /// <summary>The mobile number linked to the shop's InstaPay, as an alternative to the address.</summary>
    public string? PhoneNumber { get; set; }

    /// <summary>The name the customer will see on the transfer screen (so they know it is the right account).</summary>
    public string? AccountName { get; set; }

    public bool IsEnabled =>
        !string.IsNullOrWhiteSpace(Handle) || !string.IsNullOrWhiteSpace(PhoneNumber);
}
