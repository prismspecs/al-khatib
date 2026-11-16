<?php
/**
 * Plugin Name: AKG Privacy
 * Description: Keeps account details off the public site: no public user list in the REST API, no author archives or ?author= lookups, no users sitemap, author links point home, no X-Powered-By header.
 * Version: 1.0.0
 * Requires at least: 5.5
 * Requires PHP: 7.4
 * Author: Grayson Earle
 * Update URI: false
 */

defined( 'ABSPATH' ) || exit;

// PHP advertises its exact version in X-Powered-By; drop it from every WordPress response.
if ( ! headers_sent() ) {
	header_remove( 'X-Powered-By' );
}

// The REST API lists every author (login-derived slug + display name) to anyone.
// Keep the users routes for logged-in editors (the block editor needs them), hide them otherwise.
add_filter( 'rest_endpoints', function ( $endpoints ) {
	if ( is_user_logged_in() ) {
		return $endpoints;
	}
	foreach ( array_keys( $endpoints ) as $route ) {
		if ( 0 === strpos( $route, '/wp/v2/users' ) ) {
			unset( $endpoints[ $route ] );
		}
	}
	return $endpoints;
} );

// Author archives and ?author=N expose login slugs and the site has no use for them.
// Priority 0 so this runs before redirect_canonical turns ?author=1 into /author/<slug>/.
add_action( 'template_redirect', function () {
	if ( is_author() || isset( $_GET['author'] ) ) {
		wp_safe_redirect( home_url( '/' ), 301 );
		exit;
	}
}, 0 );

// Author links (theme templates, oEmbed author_url) would otherwise point at /author/<slug>/.
add_filter( 'author_link', function () {
	return home_url( '/' );
} );

// The core sitemap includes a users sitemap listing every author slug.
add_filter( 'wp_sitemaps_add_provider', function ( $provider, $name ) {
	return 'users' === $name ? false : $provider;
}, 10, 2 );
