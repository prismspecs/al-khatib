<?php

// echo(get_stylesheet_directory_uri() . '/assets/index.js');
	
add_action('wp_enqueue_scripts', 'enqueue_all', 10);

function enqueue_all()
{
	wp_enqueue_style('blankslate-style', get_stylesheet_uri());
// 	wp_enqueue_script( 'three-app', "https://al-khatib-glossar.com/wp-content/themes/blankslate/assets/index.js", array(), false, true );

}


add_action('wp_footer', 'blankslate_footer');
function blankslate_footer()
{

}

// SHORTCODES
function shortcode_highlight( $atts, $content = null ) {
    return '<span class="highlight">' . $content . '</span>';
}
add_shortcode('highlight', 'shortcode_highlight');

function shortcode_poem( $atts, $content = null ) {
    return '<div class="poem">' . $content . '</div>';
}
add_shortcode('poem', 'shortcode_poem');

function shortcode_arabic( $atts, $content = null ) {
    return '<div class="arabic">' . $content . '</div>';
}
add_shortcode('arabic', 'shortcode_arabic');

function blankslate_schema_type()
{
    $schema = 'https://schema.org/';
    if (is_single()) {
        $type = "Article";
    } elseif (is_author()) {
        $type = 'ProfilePage';
    } elseif (is_search()) {
        $type = 'SearchResultsPage';
    } else {
        $type = 'WebPage';
    }
    echo 'itemscope itemtype="' . esc_url($schema) . esc_attr($type) . '"';
}

add_theme_support( 'post-thumbnails' );

function acf_to_rest_api($response, $post, $request) {
    if (!function_exists('get_fields')) return $response;

    if (isset($post)) {
        $acf = get_fields($post->id);
        $response->data['acf'] = $acf;
    }
    return $response;
}
add_filter('rest_prepare_post', 'acf_to_rest_api', 10, 3);

/**
 * Lean REST API Endpoints for Al-Khatib Glossar (PLAN.md §4.2)
 * - GET /wp-json/akg/v1/glossary
 * - GET /wp-json/akg/v1/entry/<id>
 */
add_action('rest_api_init', function () {
    register_rest_route('akg/v1', '/glossary', array(
        'methods' => 'GET',
        'callback' => 'akg_get_glossary',
        'permission_callback' => '__return_true'
    ));

    register_rest_route('akg/v1', '/entry/(?P<id>\d+)', array(
        'methods' => 'GET',
        'callback' => 'akg_get_entry',
        'permission_callback' => '__return_true'
    ));
});

function akg_get_glossary() {
    $transient_key = 'akg_glossary_manifest_v1';
    $cached = get_transient($transient_key);
    if ($cached !== false) {
        return rest_ensure_response($cached);
    }

    $posts = get_posts(array(
        'category' => 2,
        'posts_per_page' => 100,
        'post_status' => 'publish'
    ));

    $manifest = array();
    foreach ($posts as $p) {
        $acf = function_exists('get_fields') ? get_fields($p->ID) : array();
        if (!$acf) $acf = array();

        $is_postcard = !empty($acf['is_postcard']) || $p->ID === 550;

        $has_de = !empty($acf['german']) && strlen(trim($acf['german'])) > 2;
        $has_en = !empty($acf['english']) && strlen(trim($acf['english'])) > 2;
        $has_ar = !empty($acf['arabic']) && strlen(trim($acf['arabic'])) > 2;

        $glyph = null;
        $thumb_id = get_post_thumbnail_id($p->ID);
        if ($thumb_id) {
            $img = wp_get_attachment_image_src($thumb_id, 'full');
            if ($img) {
                $glyph = array(
                    'url' => $img[0],
                    'w' => $img[1],
                    'h' => $img[2],
                    'aspect' => $img[2] > 0 ? ($img[1] / $img[2]) : 1.0
                );
            }
        }

        $pos = isset($acf['position']) ? $acf['position'] : array();
        $rot = isset($acf['rotation']) ? $acf['rotation'] : array();

        $related = array();
        if (!empty($acf['related']) && is_array($acf['related'])) {
            foreach ($acf['related'] as $rel) {
                $related[] = is_object($rel) ? $rel->ID : (int)$rel;
            }
        }

        $manifest[] = array(
            'id' => $p->ID,
            'slug' => $p->post_name,
            'title' => get_the_title($p->ID),
            'author' => isset($acf['author']) ? $acf['author'] : '',
            'position' => array(
                'x' => isset($pos['x']) ? (float)$pos['x'] : 0,
                'y' => isset($pos['y']) ? (float)$pos['y'] : 0,
                'z' => isset($pos['z']) ? (float)$pos['z'] : 0.3
            ),
            'rotation' => array(
                'x' => isset($rot['x']) ? (float)$rot['x'] : 0,
                'y' => isset($rot['y']) ? (float)$rot['y'] : 0,
                'z' => isset($rot['z']) ? (float)$rot['z'] : 0
            ),
            'glyph' => $glyph,
            'langs' => array(
                'de' => $has_de,
                'en' => $has_en,
                'ar' => $has_ar
            ),
            'related' => $related,
            'isPostcard' => $is_postcard
        );
    }

    set_transient($transient_key, $manifest, HOUR_IN_SECONDS * 12);
    return rest_ensure_response($manifest);
}

function akg_get_entry($request) {
    $id = (int)$request['id'];
    $post = get_post($id);
    if (!$post || $post->post_status !== 'publish') {
        return new WP_Error('not_found', 'Entry not found', array('status' => 404));
    }

    $acf = function_exists('get_fields') ? get_fields($id) : array();
    if (!$acf) $acf = array();

    $data = array(
        'id' => $post->ID,
        'slug' => $post->post_name,
        'title' => get_the_title($post->ID),
        'author' => isset($acf['author']) ? $acf['author'] : '',
        'content' => array(
            'german' => isset($acf['german']) ? $acf['german'] : '',
            'english' => isset($acf['english']) ? $acf['english'] : '',
            'arabic' => isset($acf['arabic']) ? $acf['arabic'] : ''
        )
    );

    return rest_ensure_response($data);
}

// Bust cache on save_post
add_action('save_post', function ($post_id) {
    delete_transient('akg_glossary_manifest_v1');
});
