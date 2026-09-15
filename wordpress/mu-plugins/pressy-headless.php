<?php
/**
 * Plugin Name: Pressy headless bridge
 * Description: Sends front-end visitors to the Next.js app and pings its revalidation endpoint when a post or page changes. Drop into wp-content/mu-plugins/; no activation needed.
 * Version: 1.1
 */

defined( 'ABSPATH' ) || exit;

define( 'PRESSY_HEADLESS_VERSION', '1.1' );

/**
 * Nothing about one site lives in this file, so it can be committed and
 * uploaded as is. The two values it needs come from one of:
 *
 *   1. pressy-headless-config.php next to this file. `npm run deploy` writes
 *      it from the app's env file and uploads it with this plugin.
 *   2. wp-config.php:
 *        define( 'PRESSY_NEXT_BASE', 'https://app.example' );
 *        define( 'PRESSY_REVALIDATE_SECRET', '...' );   // REVALIDATE_SECRET in the app's env
 *
 * Until both are set the plugin does nothing: no redirects, no pings.
 */
$pressy_headless_config = __DIR__ . '/pressy-headless-config.php';
if ( is_readable( $pressy_headless_config ) ) {
	require_once $pressy_headless_config;
}
unset( $pressy_headless_config );
if ( ! defined( 'PRESSY_NEXT_BASE' ) )         define( 'PRESSY_NEXT_BASE', '' );
if ( ! defined( 'PRESSY_REVALIDATE_SECRET' ) ) define( 'PRESSY_REVALIDATE_SECRET', '' );

function pressy_headless_base() {
	return rtrim( (string) PRESSY_NEXT_BASE, '/' );
}

function pressy_headless_configured() {
	$secret = (string) PRESSY_REVALIDATE_SECRET;
	return '' !== pressy_headless_base() && '' !== $secret && 'change-me' !== $secret;
}

/**
 * GET /wp-json/pressy/v1/status
 * Lets `npm run preflight` and the deploy smoke test see that the plugin is
 * installed and which app it points at. Never includes the secret.
 */
add_action( 'rest_api_init', function () {
	register_rest_route( 'pressy/v1', '/status', array(
		'methods'             => 'GET',
		'permission_callback' => '__return_true',
		'callback'            => function () {
			return array(
				'plugin'     => 'pressy-headless',
				'version'    => PRESSY_HEADLESS_VERSION,
				'configured' => pressy_headless_configured(),
				'next_base'  => pressy_headless_base(),
				'home'       => home_url(),
			);
		},
	) );
} );

/**
 * Publish, update, trash or unpublish of a post or page: tell Next.js which cache tags to drop.
 * Non-blocking, 5 s cap, so a slow or down app never delays the editor.
 */
add_action( 'transition_post_status', function ( $new_status, $old_status, $post ) {
	if ( ! pressy_headless_configured() ) return;
	if ( ! $post instanceof WP_Post || ! in_array( $post->post_type, array( 'post', 'page' ), true ) ) return;
	if ( 'publish' !== $new_status && 'publish' !== $old_status ) return;

	$slugs = function ( $terms ) { return is_array( $terms ) ? wp_list_pluck( $terms, 'slug' ) : array(); };
	$body  = array(
		'type'       => $post->post_type,
		'slug'       => $post->post_name,
		'categories' => implode( ',', $slugs( get_the_terms( $post, 'category' ) ) ),
		'tags'       => implode( ',', $slugs( get_the_terms( $post, 'post_tag' ) ) ),
		'author'     => (string) get_the_author_meta( 'user_nicename', $post->post_author ),
	);
	wp_remote_post( pressy_headless_base() . '/api/revalidate', array(
		'headers'  => array( 'x-revalidate-secret' => PRESSY_REVALIDATE_SECRET ),
		'body'     => $body, // sent as application/x-www-form-urlencoded
		'timeout'  => 5,
		'blocking' => false,
	) );
}, 10, 3 );

/**
 * Front-end requests go to the matching Next.js route with a 302.
 * Untouched: REST, feeds, admin, cron, AJAX, previews, and editors who add ?wp=1 to keep the theme.
 */
add_action( 'template_redirect', function () {
	if ( ! pressy_headless_configured() ) return;
	if ( is_admin() || wp_doing_ajax() || wp_doing_cron() || is_feed() || is_preview() || is_robots() ) return;
	if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) return;
	if ( isset( $_GET['wp'] ) && '1' === $_GET['wp'] && is_user_logged_in() && current_user_can( 'edit_posts' ) ) return;

	$path = '/';
	if ( is_front_page() || is_home() ) {
		$path = '/';
	} elseif ( is_single() && ( $post = get_queried_object() ) instanceof WP_Post && 'post' === $post->post_type ) {
		$path = '/' . get_the_date( 'Y', $post ) . '/' . get_the_date( 'm', $post ) . '/' . $post->post_name;
	} elseif ( is_page() ) {
		$path = '/' . get_page_uri( get_queried_object_id() );
	} elseif ( is_category() ) {
		$path = '/section/' . get_queried_object()->slug;
	} elseif ( is_tag() ) {
		$path = '/topic/' . get_queried_object()->slug;
	} elseif ( is_author() ) {
		$path = '/author/' . get_queried_object()->user_nicename;
	} elseif ( is_search() ) {
		$path = '/search?q=' . rawurlencode( get_search_query( false ) );
	}

	$target = pressy_headless_base() . $path;
	// Never redirect to ourselves (guards against PRESSY_NEXT_BASE pointing at this WordPress).
	if ( untrailingslashit( home_url( $_SERVER['REQUEST_URI'] ?? '' ) ) === untrailingslashit( $target ) ) return;

	wp_redirect( $target, 302 );
	exit;
} );
