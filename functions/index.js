const SITE_URL = "https://mofakira-anouar.pages.dev/";
const PREVIEW_IMAGE = "https://images.pexels.com/photos/33215776/pexels-photo-33215776/free-photo-of-elegant-still-life-of-tulips-and-open-book.jpeg?auto=compress&dpr=1&h=750&w=1260";
const TITLE = "مفكرة أنوار الذكية";
const DESCRIPTION = "مفكرة أدبية ذكية لكتابة القصائد والنصوص والأفكار وحفظها، مع أدوات للقراءة والمحتوى الصوتي والأذكار.";

const SOCIAL_META = `
<meta property="og:type" content="website">
<meta property="og:locale" content="ar_MA">
<meta property="og:site_name" content="مفكرة أنوار">
<meta property="og:title" content="${TITLE}">
<meta property="og:description" content="${DESCRIPTION}">
<meta property="og:url" content="${SITE_URL}">
<meta property="og:image" content="${PREVIEW_IMAGE}">
<meta property="og:image:secure_url" content="${PREVIEW_IMAGE}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:alt" content="توليب وردي حقيقي بجوار كتاب مفتوح على مكتب أنيق">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${TITLE}">
<meta name="twitter:description" content="${DESCRIPTION}">
<meta name="twitter:image" content="${PREVIEW_IMAGE}">
<link rel="canonical" href="${SITE_URL}">
`;

export async function onRequest(context) {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";

  // Modify only the HTML document served at the homepage; leave app assets untouched.
  if (!contentType.toLowerCase().includes("text/html")) return response;

  return new HTMLRewriter()
    .on("head", {
      element(head) {
        head.append(SOCIAL_META, { html: true });
      },
    })
    .transform(response);
}
