/**
 * Store API Edge Function
 * Handles store CRUD operations, products, and social accounts
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    // Verify user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const fnIdx = pathParts.indexOf("store-api");
    const path = fnIdx >= 0 ? "/" + (pathParts.slice(fnIdx + 1).join("/") || "") : url.pathname;
    const method = req.method;

    // Route handlers
    // GET /store - Get user's store
    if (method === "GET" && (path === "" || path === "/")) {
      const { data: store, error } = await supabase
        .from("stores")
        .select("*, social_accounts(*)")
        .eq("seller_id", userId)
        .maybeSingle();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: store }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /store - Create store
    if (method === "POST" && (path === "" || path === "/")) {
      const { name, slug, bio, logo } = await req.json();
      
      if (!name || !slug) {
        return new Response(JSON.stringify({ success: false, error: "Name and slug are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if user already has a store
      const { data: existing } = await supabase
        .from("stores")
        .select("id")
        .eq("seller_id", userId)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ success: false, error: "User already has a store" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if slug is taken
      const { data: slugExists } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (slugExists) {
        return new Response(JSON.stringify({ success: false, error: "Slug already taken" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: store, error } = await supabase
        .from("stores")
        .insert({ seller_id: userId, name, slug, bio, logo, status: "inactive", visibility: "PRIVATE" })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: store }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUT /store - Update store
    if (method === "PUT" && (path === "" || path === "/")) {
      const body = await req.json();
      const { name, slug, bio, logo, visibility, status } = body;

      const { data: store, error } = await supabase
        .from("stores")
        .update({ 
          ...(name && { name }),
          ...(slug && { slug }),
          ...(bio !== undefined && { bio }),
          ...(logo !== undefined && { logo }),
          ...(visibility && { visibility }),
          ...(status && { status }),
          updated_at: new Date().toISOString()
        })
        .eq("seller_id", userId)
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: store }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /store/products - Get store products
    if (method === "GET" && path === "/products") {
      const status = url.searchParams.get("status") || "all";
      
      const { data: store } = await supabase
        .from("stores")
        .select("id")
        .eq("seller_id", userId)
        .maybeSingle();

      if (!store) {
        return new Response(JSON.stringify({ success: true, data: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let query = supabase.from("products").select("*").eq("store_id", store.id);
      if (status !== "all") {
        query = query.eq("status", status);
      }
      
      const { data: products, error } = await query.order("updated_at", { ascending: false });
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data: products }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /store/products - Create product
    if (method === "POST" && path === "/products") {
      const { name, description, price, images } = await req.json();

      if (!name) {
        return new Response(JSON.stringify({ success: false, error: "Product name is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: store } = await supabase
        .from("stores")
        .select("id")
        .eq("seller_id", userId)
        .maybeSingle();

      if (!store) {
        return new Response(JSON.stringify({ success: false, error: "Create a store first" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: product, error } = await supabase
        .from("products")
        .insert({
          store_id: store.id,
          name,
          description,
          price,
          images: images || [],
          status: "DRAFT",
        })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: product }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUT /store/products/:id - Update product
    if (method === "PUT" && path.startsWith("/products/")) {
      const productId = path.replace("/products/", "");
      const { name, description, price, images, status } = await req.json();

      const { data: product, error } = await supabase
        .from("products")
        .update({
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(price !== undefined && { price }),
          ...(images !== undefined && { images }),
          ...(status && { status }),
          updated_at: new Date().toISOString()
        })
        .eq("id", productId)
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: product }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE /store/products/:id - Delete product
    if (method === "DELETE" && path.startsWith("/products/")) {
      const productId = path.replace("/products/", "");

      const { error } = await supabase.from("products").delete().eq("id", productId);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, message: "Product deleted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /store/social - Get social accounts
    if (method === "GET" && path === "/social") {
      const { data: store } = await supabase
        .from("stores")
        .select("id")
        .eq("seller_id", userId)
        .maybeSingle();

      if (!store) {
        return new Response(JSON.stringify({ success: true, data: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: accounts, error } = await supabase
        .from("social_accounts")
        .select("*")
        .eq("store_id", store.id);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: accounts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /store/social - Connect social account
    if (method === "POST" && path === "/social") {
      const { platform, pageUrl, pageId } = await req.json();

      if (!platform || !pageUrl) {
        return new Response(JSON.stringify({ success: false, error: "Platform and pageUrl are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: store } = await supabase
        .from("stores")
        .select("id")
        .eq("seller_id", userId)
        .maybeSingle();

      if (!store) {
        return new Response(JSON.stringify({ success: false, error: "Create a store first" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: account, error } = await supabase
        .from("social_accounts")
        .insert({ store_id: store.id, platform, page_url: pageUrl, page_id: pageId })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: account }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE /store/social/:id - Disconnect social account
    if (method === "DELETE" && path.startsWith("/social/")) {
      const accountId = path.replace("/social/", "");

      const { error } = await supabase.from("social_accounts").delete().eq("id", accountId);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, message: "Account disconnected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== REVIEWS (Seller) ====================
    if (method === "GET" && path === "/reviews") {
      const status = url.searchParams.get("status") || "all";
      const rating = url.searchParams.get("rating") || "";
      const productId = url.searchParams.get("product_id") || "";
      const sort = url.searchParams.get("sort") || "recent";
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

      let q = supabase
        .from("product_reviews")
        .select("*, products(id, name, images)", { count: "exact" })
        .eq("seller_id", userId);

      if (status !== "all") q = q.eq("status", status);
      if (rating) q = q.eq("rating", parseInt(rating));
      if (productId) q = q.eq("product_id", productId);

      if (sort === "rating_high") q = q.order("rating", { ascending: false });
      else if (sort === "rating_low") q = q.order("rating", { ascending: true });
      else q = q.order("created_at", { ascending: false });

      const { data: reviews, error, count } = await q.range((page - 1) * limit, page * limit - 1);
      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        data: {
          reviews: reviews || [],
          pagination: {
            page,
            limit,
            total: count || 0,
            pages: Math.ceil((count || 0) / limit),
          },
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/reviews/analytics") {
      const startDate = url.searchParams.get("start_date") || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const endDate = url.searchParams.get("end_date") || new Date().toISOString().slice(0, 10);
      const productId = url.searchParams.get("product_id") || "";

      let analyticsQuery = supabase
        .from("product_reviews")
        .select("id, rating, created_at, product_id, images, video_url, seller_response, is_verified_purchase")
        .eq("seller_id", userId)
        .eq("status", "approved")
        .gte("created_at", startDate)
        .lte("created_at", endDate + "T23:59:59");
      if (productId) analyticsQuery = analyticsQuery.eq("product_id", productId);
      const { data: reviews, error } = await analyticsQuery;

      if (error) throw error;

      const r = reviews || [];
      const total = r.length;
      const avg = total > 0 ? r.reduce((s, x) => s + (x.rating || 0), 0) / total : 0;
      const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      r.forEach((x) => { dist[Math.min(5, Math.max(1, x.rating || 0))]++; });
      const withPhotos = r.filter((x) => Array.isArray(x.images) && x.images.length > 0).length;
      const withVideos = r.filter((x) => !!x.video_url).length;
      const responded = r.filter((x) => !!x.seller_response).length;

      return new Response(JSON.stringify({
        success: true,
        data: {
          summary: {
            total_reviews: total,
            average_rating: avg.toFixed(2),
            rating_distribution: dist,
            with_photos: withPhotos,
            with_videos: withVideos,
            response_rate: total > 0 ? ((responded / total) * 100).toFixed(1) : "0",
          },
          trend: [],
          top_products: [],
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "POST" && path.match(/^\/reviews\/[a-zA-Z0-9-]+\/respond$/)) {
      const reviewId = path.split("/")[2];
      const { response } = await req.json();
      if (!response) {
        return new Response(JSON.stringify({ success: false, error: "Response text required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase
        .from("product_reviews")
        .update({
          seller_response: response,
          seller_responded_at: new Date().toISOString(),
          seller_responder_id: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reviewId)
        .eq("seller_id", userId)
        .select()
        .single();
      if (error) throw error;
      if (!data) {
        return new Response(JSON.stringify({ success: false, error: "Review not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "PATCH" && path.match(/^\/reviews\/[a-zA-Z0-9-]+\/status$/)) {
      const reviewId = path.split("/")[2];
      const { status: newStatus } = await req.json();
      if (!["approved", "rejected"].includes(newStatus)) {
        return new Response(JSON.stringify({ success: false, error: "Status must be approved or rejected" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase
        .from("product_reviews")
        .update({
          status: newStatus,
          is_published: newStatus === "approved",
          published_at: newStatus === "approved" ? new Date().toISOString() : null,
          moderation_status: "reviewed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", reviewId)
        .eq("seller_id", userId)
        .select()
        .single();
      if (error) throw error;
      if (!data) {
        return new Response(JSON.stringify({ success: false, error: "Review not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "GET" && path === "/reviews/requestable-orders") {
      const { data: txList } = await supabase
        .from("transactions")
        .select("id, item_name, created_at, product_id")
        .eq("seller_id", userId)
        .in("status", ["completed", "delivered"])
        .order("created_at", { ascending: false })
        .limit(100);
      const orderIds = (txList || []).map((t) => t.id);
      const { data: existing } = await supabase
        .from("review_requests")
        .select("order_id")
        .eq("seller_id", userId)
        .in("order_id", orderIds.length ? orderIds : ["__none__"]);
      const requestedSet = new Set((existing || []).map((r) => r.order_id));
      const requestable = (txList || []).filter((t) => !requestedSet.has(t.id));
      return new Response(JSON.stringify({ success: true, data: requestable }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && path === "/reviews/request") {
      const { order_ids, send_via = "email", delay_days = 0 } = await req.json();
      if (!Array.isArray(order_ids) || order_ids.length === 0) {
        return new Response(JSON.stringify({ success: false, error: "order_ids array required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: store } = await supabase.from("stores").select("id, name, slug").eq("seller_id", userId).maybeSingle();
      if (!store) {
        return new Response(JSON.stringify({ success: false, error: "Store not found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const inserted: string[] = [];
      for (const orderId of order_ids.slice(0, 50)) {
        const { data: tx } = await supabase.from("transactions").select("id, buyer_id").eq("id", orderId).eq("seller_id", userId).maybeSingle();
        if (!tx) continue;
        const { data: oi } = await supabase.from("transactions").select("product_id").eq("id", orderId).maybeSingle();
        const productIds = oi?.product_id ? [oi.product_id] : [];
        const { error } = await supabase.from("review_requests").insert({
          seller_id: userId,
          order_id: orderId,
          customer_id: tx.buyer_id,
          product_ids: productIds,
          request_type: send_via,
          status: delay_days > 0 ? "pending" : "sent",
          sent_at: delay_days > 0 ? null : new Date().toISOString(),
        });
        if (!error) inserted.push(orderId);
      }
      return new Response(JSON.stringify({ success: true, requests_sent: inserted.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && path === "/reviews/auto-request/config") {
      const body = await req.json();
      const { enabled, delay_days, send_via, incentive_type, incentive_value } = body;
      const { data, error } = await supabase
        .from("seller_review_settings")
        .upsert({
          seller_id: userId,
          review_auto_request_enabled: !!enabled,
          review_auto_request_delay_days: delay_days ?? 7,
          review_auto_request_method: send_via || "email",
          updated_at: new Date().toISOString(),
        }, { onConflict: "seller_id" })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "GET" && path === "/reviews/auto-request/config") {
      const { data, error } = await supabase
        .from("seller_review_settings")
        .select("*")
        .eq("seller_id", userId)
        .maybeSingle();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: data || { review_auto_request_enabled: false } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "GET" && path === "/reviews/questions") {
      const { data: store } = await supabase.from("stores").select("id").eq("seller_id", userId).maybeSingle();
      if (!store) {
        return new Response(JSON.stringify({ success: true, data: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: products } = await supabase.from("products").select("id").eq("store_id", store.id);
      const productIds = (products || []).map((p) => p.id);
      if (!productIds.length) {
        return new Response(JSON.stringify({ success: true, data: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: questions, error } = await supabase
        .from("review_questions")
        .select("*, products(id, name)")
        .in("product_id", productIds)
        .eq("is_answered", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const qIds = (questions || []).map((q) => q.id);
      const { data: answers } = await supabase.from("review_answers").select("*").in("question_id", qIds.length ? qIds : ["00000000-0000-0000-0000-000000000000"]);
      const ansByQ: Record<string, any[]> = {};
      (answers || []).forEach((a) => {
        if (!ansByQ[a.question_id]) ansByQ[a.question_id] = [];
        ansByQ[a.question_id].push(a);
      });
      const withAnswers = (questions || []).map((q) => ({ ...q, answers: ansByQ[q.id] || [] }));
      return new Response(JSON.stringify({ success: true, data: withAnswers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && path.match(/^\/questions\/[a-zA-Z0-9-]+\/answer$/)) {
      const questionId = path.split("/")[2];
      const { answer } = await req.json();
      if (!answer || answer.length < 5) {
        return new Response(JSON.stringify({ success: false, error: "Answer min 5 chars" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: q } = await supabase
        .from("review_questions")
        .select("id, product_id")
        .eq("id", questionId)
        .single();
      if (!q) {
        return new Response(JSON.stringify({ success: false, error: "Question not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: product } = await supabase.from("products").select("store_id").eq("id", q.product_id).single();
      const { data: store } = await supabase.from("stores").select("seller_id").eq("id", product?.store_id).single();
      if (!store || store.seller_id !== userId) {
        return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: a, error } = await supabase
        .from("review_answers")
        .insert({ question_id: questionId, answerer_id: userId, answerer_type: "seller", answer: answer.slice(0, 2000), is_official: true })
        .select()
        .single();
      if (error) throw error;
      await supabase.from("review_questions").update({ is_answered: true }).eq("id", questionId);
      return new Response(JSON.stringify({ success: true, data: a }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && path === "/reviews/bulk-update") {
      const { review_ids, status: newStatus } = await req.json();
      if (!Array.isArray(review_ids) || !["approved", "rejected"].includes(newStatus)) {
        return new Response(JSON.stringify({ success: false, error: "review_ids array and status required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabase
        .from("product_reviews")
        .update({
          status: newStatus,
          is_published: newStatus === "approved",
          published_at: newStatus === "approved" ? new Date().toISOString() : null,
          moderation_status: "reviewed",
          updated_at: new Date().toISOString(),
        })
        .eq("seller_id", userId)
        .in("id", review_ids);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, updated: review_ids.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== FINANCIAL ====================
    if (method === "GET" && path === "/financial/dashboard") {
      const period = url.searchParams.get("period") || "30d";
      const days = period === "7d" ? 7 : period === "90d" ? 90 : period === "1y" ? 365 : 30;
      const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      const endDate = new Date().toISOString().slice(0, 10);

      const { data: txRows } = await supabase
        .from("transactions")
        .select("amount, seller_payout, platform_fee, status")
        .eq("seller_id", userId)
        .gte("created_at", startDate)
        .lte("created_at", endDate + "T23:59:59");

      const completed = (txRows || []).filter((t) => (t.status || "").toLowerCase() === "completed");
      const refunded = (txRows || []).filter((t) => (t.status || "").toLowerCase() === "refunded");
      const revenue = completed.reduce((s, t) => s + (Number(t.seller_payout ?? t.amount ?? 0)), 0);
      const refunds = refunded.reduce((s, t) => s + (Number(t.amount ?? 0)), 0);
      const commission = completed.reduce((s, t) => s + (Number(t.platform_fee ?? 0)), 0);

      const { data: expenseRows } = await supabase
        .from("seller_expenses")
        .select("amount")
        .eq("seller_id", userId)
        .eq("status", "active")
        .gte("expense_date", startDate)
        .lte("expense_date", endDate);

      const expenses = (expenseRows || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const grossProfit = revenue - refunds;
      const netProfit = grossProfit - expenses;
      const profitMargin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(2) : "0";

      return new Response(JSON.stringify({
        success: true,
        data: {
          summary: {
            revenue,
            refunds,
            gross_profit: grossProfit,
            commission,
            payment_fees: 0,
            expenses,
            net_revenue: grossProfit,
            net_profit: netProfit,
            profit_margin: profitMargin,
          },
          trend: [],
          breakdown: [],
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "GET" && path === "/financial/expenses") {
      const category = url.searchParams.get("category") || "";
      const startDate = url.searchParams.get("start_date") || "";
      const endDate = url.searchParams.get("end_date") || "";
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

      let q = supabase
        .from("seller_expenses")
        .select("*", { count: "exact" })
        .eq("seller_id", userId)
        .eq("status", "active");

      if (category) q = q.eq("category", category);
      if (startDate) q = q.gte("expense_date", startDate);
      if (endDate) q = q.lte("expense_date", endDate);

      const { data: expenses, error, count } = await q
        .order("expense_date", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (error) throw error;
      return new Response(JSON.stringify({
        success: true,
        data: {
          expenses: expenses || [],
          pagination: {
            page,
            limit,
            total: count || 0,
            pages: Math.ceil((count || 0) / limit),
          },
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "POST" && path === "/financial/expenses") {
      const body = await req.json();
      const { amount, category, description, vendor_name, expense_date, is_tax_deductible } = body;
      if (!amount || !category || !description || !expense_date) {
        return new Response(JSON.stringify({ success: false, error: "amount, category, description, expense_date required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase
        .from("seller_expenses")
        .insert({
          seller_id: userId,
          amount: parseFloat(amount),
          category,
          description,
          vendor_name: vendor_name || null,
          expense_date,
          is_tax_deductible: is_tax_deductible !== false,
        })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "PATCH" && path.match(/^\/financial\/expenses\/[a-zA-Z0-9-]+$/)) {
      const expenseId = path.split("/")[3];
      const body = await req.json();
      const { data, error } = await supabase
        .from("seller_expenses")
        .update({
          ...(body.amount !== undefined && { amount: parseFloat(body.amount) }),
          ...(body.category && { category: body.category }),
          ...(body.description && { description: body.description }),
          ...(body.vendor_name !== undefined && { vendor_name: body.vendor_name }),
          ...(body.expense_date && { expense_date: body.expense_date }),
          updated_at: new Date().toISOString(),
        })
        .eq("id", expenseId)
        .eq("seller_id", userId)
        .select()
        .single();
      if (error) throw error;
      if (!data) {
        return new Response(JSON.stringify({ success: false, error: "Expense not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "DELETE" && path.match(/^\/financial\/expenses\/[a-zA-Z0-9-]+$/)) {
      const expenseId = path.split("/")[3];
      const { error } = await supabase
        .from("seller_expenses")
        .update({ status: "deleted", updated_at: new Date().toISOString() })
        .eq("id", expenseId)
        .eq("seller_id", userId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "GET" && path === "/financial/reports/profit-loss") {
      const startDate = url.searchParams.get("start_date") || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const endDate = url.searchParams.get("end_date") || new Date().toISOString().slice(0, 10);

      const { data: txRows } = await supabase
        .from("transactions")
        .select("amount, seller_payout, platform_fee, status")
        .eq("seller_id", userId)
        .gte("created_at", startDate)
        .lte("created_at", endDate + "T23:59:59");

      const completed = (txRows || []).filter((t) => (t.status || "").toLowerCase() === "completed");
      const refunded = (txRows || []).filter((t) => (t.status || "").toLowerCase() === "refunded");
      const revenue = completed.reduce((s, t) => s + (Number(t.seller_payout ?? t.amount ?? 0)), 0);
      const refunds = refunded.reduce((s, t) => s + (Number(t.amount ?? 0)), 0);
      const commission = completed.reduce((s, t) => s + (Number(t.platform_fee ?? 0)), 0);

      const { data: expenseRows } = await supabase
        .from("seller_expenses")
        .select("category, amount")
        .eq("seller_id", userId)
        .eq("status", "active")
        .gte("expense_date", startDate)
        .lte("expense_date", endDate);

      const expenses = (expenseRows || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const byCategory: Record<string, number> = {};
      (expenseRows || []).forEach((e) => {
        const cat = e.category || "other";
        byCategory[cat] = (byCategory[cat] || 0) + (Number(e.amount) || 0);
      });

      const grossProfit = revenue - refunds;
      const netProfit = grossProfit - expenses;
      const profitMargin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(2) : "0";

      return new Response(JSON.stringify({
        success: true,
        data: {
          period: { start: startDate, end: endDate },
          revenue: {
            gross_sales: revenue,
            refunds,
            net_sales: grossProfit,
          },
          gross_profit: grossProfit,
          expenses: {
            platform_commission: commission,
            payment_processing: 0,
            operating_expenses: expenses,
            total_expenses: commission + expenses,
            by_category: byCategory,
          },
          net_profit: netProfit,
          profit_margin: profitMargin,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==================== LIVE CHAT ====================
    if (method === "GET" && path === "/chat/conversations") {
      const { data: convos, error } = await supabase
        .from("chat_conversations")
        .select("*")
        .eq("seller_id", userId)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(50);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: convos || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "GET" && path.match(/^\/chat\/conversations\/[a-zA-Z0-9-]+$/)) {
      const convId = path.split("/")[3];
      const { data: convo, error: ce } = await supabase
        .from("chat_conversations")
        .select("*")
        .eq("id", convId)
        .eq("seller_id", userId)
        .single();
      if (ce || !convo) {
        return new Response(JSON.stringify({ success: false, error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: messages, error: me } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });
      if (me) throw me;
      return new Response(JSON.stringify({ success: true, data: { ...convo, messages: messages || [] } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && path.match(/^\/chat\/conversations\/[a-zA-Z0-9-]+\/messages$/)) {
      const convId = path.split("/")[3];
      const { message } = await req.json();
      if (!message) {
        return new Response(JSON.stringify({ success: false, error: "message required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: convo } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("id", convId)
        .eq("seller_id", userId)
        .single();
      if (!convo) {
        return new Response(JSON.stringify({ success: false, error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: profile } = await supabase.from("profiles").select("name").eq("user_id", userId).maybeSingle();
      const { data: msg, error } = await supabase
        .from("chat_messages")
        .insert({
          conversation_id: convId,
          sender_id: userId,
          sender_type: "seller",
          sender_name: profile?.name || "Seller",
          message: message.slice(0, 2000),
        })
        .select()
        .single();
      if (error) throw error;
      await supabase
        .from("chat_conversations")
        .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", convId);
      return new Response(JSON.stringify({ success: true, data: msg }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== SUPPORT ====================
    if (method === "GET" && path === "/support/tickets") {
      const { data: tickets, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: tickets || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && path === "/support/tickets") {
      const body = await req.json();
      const { subject, category, priority } = body;
      if (!subject) {
        return new Response(JSON.stringify({ success: false, error: "subject required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: ticket, error } = await supabase
        .from("support_tickets")
        .insert({
          user_id: userId,
          subject: subject.slice(0, 255),
          category: category || null,
          priority: priority || "normal",
          status: "open",
        })
        .select()
        .single();
      if (error) throw error;
      const { message } = body;
      if (message) {
        await supabase.from("support_messages").insert({
          ticket_id: ticket.id,
          sender_id: userId,
          is_staff: false,
          message: message.slice(0, 5000),
        });
      }
      return new Response(JSON.stringify({ success: true, data: ticket }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "GET" && path.match(/^\/support\/tickets\/[a-zA-Z0-9-]+$/)) {
      const ticketId = path.split("/")[3];
      const { data: ticket, error: te } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("id", ticketId)
        .eq("user_id", userId)
        .single();
      if (te || !ticket) {
        return new Response(JSON.stringify({ success: false, error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: messages } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      return new Response(JSON.stringify({ success: true, data: { ...ticket, messages: messages || [] } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && path.match(/^\/support\/tickets\/[a-zA-Z0-9-]+\/messages$/)) {
      const ticketId = path.split("/")[3];
      const { message } = await req.json();
      if (!message) {
        return new Response(JSON.stringify({ success: false, error: "message required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: ticket } = await supabase
        .from("support_tickets")
        .select("id")
        .eq("id", ticketId)
        .eq("user_id", userId)
        .single();
      if (!ticket) {
        return new Response(JSON.stringify({ success: false, error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: msg, error } = await supabase
        .from("support_messages")
        .insert({ ticket_id: ticketId, sender_id: userId, is_staff: false, message: message.slice(0, 5000) })
        .select()
        .single();
      if (error) throw error;
      await supabase.from("support_tickets").update({ updated_at: new Date().toISOString() }).eq("id", ticketId);
      return new Response(JSON.stringify({ success: true, data: msg }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && path === "/financial/payouts/instant") {
      return new Response(JSON.stringify({
        success: false,
        error: "Instant payout requires minimum balance and is available on Pro plan. Use standard withdrawal from Wallet.",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "GET" && path === "/financial/integrations") {
      const { data, error } = await supabase
        .from("accounting_integrations")
        .select("*")
        .eq("seller_id", userId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST" && path.match(/^\/financial\/integrations\/[a-zA-Z0-9-]+\/connect$/)) {
      const provider = path.split("/")[3];
      return new Response(JSON.stringify({
        success: false,
        error: `Connect ${provider}: OAuth integration coming soon. Export data from Financial tab.`,
      }), {
        status: 501,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "GET" && path === "/financial/reports/tax") {
      const year = parseInt(url.searchParams.get("year") || String(new Date().getFullYear()));
      const quarter = url.searchParams.get("quarter") || "";

      let startDate: string;
      let endDate: string;
      if (quarter && ["1", "2", "3", "4"].includes(quarter)) {
        const q = parseInt(quarter);
        startDate = `${year}-${String((q - 1) * 3 + 1).padStart(2, "0")}-01`;
        endDate = `${year}-${String(q * 3).padStart(2, "0")}-${q === 2 ? "30" : q === 4 ? "31" : "31"}`;
      } else {
        startDate = `${year}-01-01`;
        endDate = `${year}-12-31`;
      }

      const { data: txRows } = await supabase
        .from("transactions")
        .select("amount, seller_payout, platform_fee, status")
        .eq("seller_id", userId)
        .gte("created_at", startDate)
        .lte("created_at", endDate + "T23:59:59");

      const completed = (txRows || []).filter((t) => (t.status || "").toLowerCase() === "completed");
      const refunded = (txRows || []).filter((t) => (t.status || "").toLowerCase() === "refunded");
      const totalSales = completed.reduce((s, t) => s + (Number(t.seller_payout ?? t.amount ?? 0)), 0);
      const totalRefunds = refunded.reduce((s, t) => s + (Number(t.amount ?? 0)), 0);

      const { data: expenseRows } = await supabase
        .from("seller_expenses")
        .select("amount")
        .eq("seller_id", userId)
        .eq("status", "active")
        .gte("expense_date", startDate)
        .lte("expense_date", endDate);

      const totalExpenses = (expenseRows || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const taxableIncome = totalSales - totalRefunds - totalExpenses;

      return new Response(JSON.stringify({
        success: true,
        data: {
          report_type: quarter ? "quarterly" : "annual",
          year,
          quarter: quarter ? parseInt(quarter) : null,
          total_sales: totalSales,
          total_refunds: totalRefunds,
          total_expenses: totalExpenses,
          taxable_income: taxableIncome,
          status: "draft",
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: false, error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Store API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
