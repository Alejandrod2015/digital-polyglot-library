type DigitalGoodsItemDetails = {
  itemId: string;
  title?: string;
  description?: string;
  price?: {
    currency: string;
    value: string;
  };
  subscriptionPeriod?: string;
  freeTrialPeriod?: string;
};

type DigitalGoodsPurchaseDetails = {
  itemId: string;
  purchaseToken: string;
};

interface DigitalGoodsService {
  getDetails(itemIds: string[]): Promise<DigitalGoodsItemDetails[]>;
  listPurchases(): Promise<DigitalGoodsPurchaseDetails[]>;
  acknowledge?(purchaseToken: string, makeAvailableAgain?: string): Promise<void>;
}

interface Window {
  getDigitalGoodsService?: (
    serviceProvider: "https://play.google.com/billing"
  ) => Promise<DigitalGoodsService>;
}
