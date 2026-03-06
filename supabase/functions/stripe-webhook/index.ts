import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  console.log(`[STRIPE-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

serve(async (req) => {
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const body = await req.text();

    let event: Stripe.Event;
    if (webhookSecret) {
      const sig = req.headers.get("stripe-signature")!;
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } else {
      event = JSON.parse(body) as Stripe.Event;
    }

    logStep("Event received", { type: event.type, id: event.id });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const handleSubscriptionChange = async (subscription: Stripe.Subscription) => {
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      
      // Find user by stripe_customer_id
      const { data: planRow } = await supabase
        .from("user_plans")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();

      let userId = planRow?.user_id;

      if (!userId) {
        // Try to find by customer email
        const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
        if (customer.email) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("email", customer.email)
            .maybeSingle();
          userId = profile?.user_id;
        }
      }

      if (!userId) {
        logStep("No user found for customer", { customerId });
        return;
      }

      const isActive = subscription.status === "active" || subscription.status === "trialing";
      const plan = isActive ? "pro" : "free";
      const billingEnd = new Date(subscription.current_period_end * 1000).toISOString();

      await supabase.from("user_plans").update({
        plan,
        subscription_status: subscription.status,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        billing_cycle_end: billingEnd,
      }).eq("user_id", userId);

      logStep("Updated user plan", { userId, plan, status: subscription.status });
    };

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await handleSubscriptionChange(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(sub);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          const { data: planRow } = await supabase
            .from("user_plans")
            .select("user_id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          if (planRow?.user_id) {
            await supabase.from("user_plans").update({
              subscription_status: "past_due",
            }).eq("user_id", planRow.user_id);
            logStep("Marked past_due", { userId: planRow.user_id });
          }
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logStep("ERROR", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
