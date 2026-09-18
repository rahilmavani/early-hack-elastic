import asyncio
import random
import re

from playwright.async_api import Page, expect

from eyewitness.config import REPO_ROOT

REVIEW_PHOTO = REPO_ROOT / "src/storefront/public/products/canvas-tote-2.jpg"

CATEGORIES = ["men", "women", "footwear", "accessories"]

CHECKOUT_FIELDS = {
    "Email": "asha@example.com",
    "Phone": "9876543210",
    "Full name": "Asha Demo",
    "Address line 1": "12 Test Lane",
    "City": "Bengaluru",
    "State": "Karnataka",
    "PIN code": "560001",
    "Card number": "4242424242424242",
    "Name on card": "Asha Demo",
    "Expiry": "1229",
    "CVV": "123",
}


async def pause(low: float = 0.6, high: float = 1.8) -> None:
    await asyncio.sleep(random.uniform(low, high))


async def open_random_product(page: Page) -> None:
    category = random.choice(CATEGORIES)
    await page.locator("header").get_by_role("link", name=category.title(), exact=True).click()
    await page.wait_for_url(f"**/c/{category}**")
    await pause()
    await page.mouse.wheel(0, random.randint(200, 900))
    await pause()
    cards = page.locator('main a[href^="/p/"]')
    count = await cards.count()
    await cards.nth(random.randrange(count)).click()
    await page.wait_for_url("**/p/**")
    await pause(1.0, 2.5)


async def choose_size_and_add_to_bag(page: Page) -> None:
    size_buttons = page.get_by_role("button", name=re.compile(r"^Size "))
    count = await size_buttons.count()
    if count > 1:
        await size_buttons.nth(random.randrange(count)).click()
        await pause(0.3, 0.8)
    await page.get_by_role("button", name="Add to bag").click()
    await pause()


async def fill_checkout(page: Page, skip_field: str | None = None) -> None:
    for label, value in CHECKOUT_FIELDS.items():
        if label == skip_field:
            continue
        await page.get_by_label(label, exact=True).fill(value)
        await pause(0.15, 0.5)


async def click_place_order_repeatedly(page: Page, times: int) -> None:
    button = page.get_by_role("button", name="Place order")
    for attempt in range(times):
        await button.click()
        await pause(1.5, 3.5) if attempt == 0 else await pause(0.8, 1.6)


async def browse(page: Page) -> None:
    await open_random_product(page)
    await page.mouse.wheel(0, 600)
    await pause()
    if random.random() < 0.5:
        await open_random_product(page)


async def purchase(
    page: Page,
    skip_field: str | None = None,
    retries: int = 0,
    expect_payment_timeout: bool = False,
) -> None:
    await open_random_product(page)
    await choose_size_and_add_to_bag(page)
    await page.locator("header").get_by_role("link", name="Bag").click()
    await page.wait_for_url("**/bag")
    await pause()
    await page.get_by_role("button", name="Proceed to checkout").click()
    await page.wait_for_url("**/checkout")
    await pause(1.0, 2.0)
    await fill_checkout(page, skip_field=skip_field)
    if retries:
        await click_place_order_repeatedly(page, times=retries)
        return
    if expect_payment_timeout:
        async with page.expect_response(
            lambda response: (
                response.url.endswith("/api/orders") and response.request.method == "POST"
            ),
            timeout=15000,
        ) as pending_response:
            await page.get_by_role("button", name="Place order").click()
            await expect(page.get_by_role("button", name="Placing order...")).to_be_disabled()
        response = await pending_response.value
        if response.status != 504:
            raise AssertionError(f"Expected payment timeout (504), got {response.status}")
        error_message = "We couldn't place your order. Please try again."
        await expect(page.get_by_role("alert").filter(has_text=error_message)).to_have_text(
            error_message
        )
        await expect(page.get_by_role("button", name="Place order")).to_be_enabled()
        await pause(2.0, 3.0)
        return
    await page.get_by_role("button", name="Place order").click()
    await page.wait_for_url("**/order/**", timeout=15000)
    await pause(2.0, 3.0)


async def adjust_bag_quantity(page: Page, changes: int) -> None:
    await open_random_product(page)
    await choose_size_and_add_to_bag(page)
    await page.locator("header").get_by_role("link", name="Bag").click()
    await page.wait_for_url("**/bag")
    await pause()
    increase = page.get_by_role("button", name="Increase quantity")
    for _ in range(changes):
        await increase.click()
        await pause(1.0, 2.0)
    await pause(2.0, 4.0)


async def write_review(page: Page, with_photo: bool) -> None:
    await open_random_product(page)
    await page.get_by_role("button", name="Write a review").scroll_into_view_if_needed()
    await page.get_by_role("button", name="Write a review").click()
    await pause()
    await page.get_by_role("radio", name="4 stars").click()
    await page.get_by_label("Title", exact=True).fill("Does the job")
    await page.get_by_label("Review", exact=True).fill(
        "Fits as described and arrived two days early. Would buy again."
    )
    await page.get_by_label("Your name", exact=True).fill("Test User")
    if with_photo:
        await page.locator("#review-photo").set_input_files(str(REVIEW_PHOTO))
        await pause()
    await page.get_by_role("button", name="Post review").click()
    await pause(2.0, 4.0)
