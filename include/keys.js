/**
 * Many customers use PubNub to implement chat into their solution, so they don't have to
 * worry about scale, reliability or other infrastructure considerations.  If you are reading
 * this source code, hopefully you are implementing an app with PubNub :)  THANK YOU!
 * Here are some tips for things you'll need to watch out for as you move to production, this is
 * just a demo and beyond the usual caveats to add 'error handling' code, it's worth bearing the
 * following in mind
 * IN PRODUCTION:
 * - PubNub provides all the underlying APIs you need to implement your chat solution but we don't
 *   provide an opinionated visual design - feel free to build your own UI on top of our APIs, this
 *   demo uses a very basic chat UI to 'get the idea across'
 * - PubNub uses a flexible channel architecture for communication, endpoints 'subscribe' and 'publish'
 *   messages to channels.  By naming channels in a sensible hierarchy you can enable public and
 *   private groups.  This demo follows the same naming convention a number of our customers use for
 *   'Public.<channel>', 'Private.<channel>' and 'DM.A~B', enabling all possible grouping use cases.
 *   In production, you will use Access Manager to restrict access to channels as appropriate but that
 *   is not done in this demo, for readability.
 * - This demo does not encrypt any messages, but you could do this if you chose to do so for additional
 *   privacy and security.  Obviously all messages are already sent over secure connection and PubNub
 *   is SOC2 compliant so even if you do not choose to implement message encryption, your messages are
 *   still secure.
 * - Subscription: This demo uses wildcard subscription in conjunction with the channel naming topology
 *   to listen for new messages.  This will be sufficient for most production use cases but if you need
 *   an even greater number of channels then please see our Channel Groups feature.
 * - Presence: This demo uses PubNub's Presence APIs to detect who is online.  Presence is based subscription
 *   which, in the case of this demo, is to 'channel.*', so a user will be shown as online even if they are
 *   not viewing the same conversation as you.  Presence is configurable at both the client and server level,
 *   for example you can choose to unsubscribe / resubscribe to channels as you switch conversations and additional
 *   options are available on the admin portal (for example, unsubscribing when a TCP ACK is received).
 * - Typing indicator: We recommend you use PubNub signals, as this demo does.  This demo's logic for the typing
 *   indicator with groups, where multiple people are typing, is quite simple (especially the use of setTimeout).
 *   In production, you would have more robust logic but, again, the demo was written with readibility in mind.
 *   PubNub signals will meet your typing indicator use case regardless of scale.
 * - Message Persistence: The chat history in this hosted demo only persist for 1 day.  That is a deliberate choice since
 *   this is only a demo but in production, this is something you can configure from your PubNub admin dashboard, so
 *   data can be persisted as long as you need.  The Message Persistence API (you may also see this referred to as the history API) can retrieve messages (along with
 *   their accompanying reaction) as far back as you need but for readibility, this demo only goes back to the past
 *   30 messages.
 * - Functions: Functions provide server logic that can be exeuted after an event occurs, such as a message is published
 *   or a file is uploaded.  Functions are used by this demo to moderate text but are not used beyond
 *   that.  In production, you might choose to use functions to perform inline language translation or to store a
 *   copy of any message in your own storage for analytics purposes (you can also use Events & Actions for this
 *   analytics use case)
 */

/**
 * Populate this file with both your PubNub keys
 * Please see the ReadMe file for details of where to obtain keys
 */
const publish_key = 'pub-c-15fc919e-3d3c-4922-bc6d-5232e7da0569' //  ENTER YOUR PUBLISH KEY HERE
const subscribe_key = 'sub-c-28db1648-85a4-4cc5-9abc-b749842134ba' //  ENTER YOUR SUBSCRIBE KEY HERE
